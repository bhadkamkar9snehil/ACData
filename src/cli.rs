//! Command-line entry point for the Accu-Chek backend.

use std::env;

use log::{info, warn};

use crate::config::{
    config_file_path, default_database_path, default_export_dir, ensure_data_dir, get_data_dir,
    Config,
};
use crate::error::AccuChekError;
use crate::{analysis::analyze, storage::Storage, sync::sync_device};

#[derive(Debug, PartialEq)]
enum Command {
    Guidance,
    Sync(Option<usize>),
    Help,
    Version,
    Paths,
    Data(String),
    Analyze(String),
}

fn parse_args<I, S>(args: I) -> Result<Command, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let args: Vec<String> = args
        .into_iter()
        .map(|argument| argument.as_ref().to_owned())
        .collect();
    let command_args = args.get(1..).unwrap_or_default();

    match command_args {
        [] => Ok(Command::Guidance),
        [command] if matches!(command.as_str(), "sync" | "download") => Ok(Command::Sync(None)),
        [command, device_index] if matches!(command.as_str(), "sync" | "download") => {
            parse_device_index(device_index)
        }
        [command] if matches!(command.as_str(), "--help" | "-h" | "help") => Ok(Command::Help),
        [command] if matches!(command.as_str(), "--version" | "-V") => Ok(Command::Version),
        [command] if matches!(command.as_str(), "path" | "paths") => Ok(Command::Paths),
        [command] if command == "data" => Ok(Command::Data("all".to_owned())),
        [command, period] if command == "data" => Ok(Command::Data(period.to_owned())),
        [command] if command == "analyze" => Ok(Command::Analyze("30d".to_owned())),
        [command, period] if command == "analyze" => Ok(Command::Analyze(period.to_owned())),
        [command, trailing @ ..] if is_known_command(command) => Err(format!(
            "unexpected argument{} after '{command}': {}",
            if trailing.len() == 1 { "" } else { "s" },
            trailing.join(" ")
        )),
        [command, ..] => Err(format!("unknown command '{command}'")),
    }
}

fn parse_device_index(device_index: &str) -> Result<Command, String> {
    device_index
        .parse()
        .map(|index| Command::Sync(Some(index)))
        .map_err(|_| {
            format!("invalid device index '{device_index}': expected a non-negative integer")
        })
}

fn is_known_command(command: &str) -> bool {
    matches!(
        command,
        "sync"
            | "download"
            | "--help"
            | "-h"
            | "help"
            | "--version"
            | "-V"
            | "path"
            | "paths"
            | "data"
            | "analyze"
    )
}

/// Run the command-line application.
pub fn run() -> Result<(), AccuChekError> {
    let args: Vec<String> = env::args().collect();
    let command = parse_args(&args).map_err(AccuChekError::InvalidArguments)?;
    let debug_mode = env::var("ACCUCHEK_DBG").is_ok();
    initialize_logging(debug_mode);

    if let Command::Data(period) | Command::Analyze(period) = &command {
        let (_, db_path) = load_config(debug_mode);
        let storage = Storage::new(db_path)?;
        let readings = filter_period(storage.get_all_readings()?, period)?;
        let value = if matches!(command, Command::Data(_)) {
            serde_json::json!({ "schema_version": "1.0", "period": period, "readings": readings })
        } else {
            serde_json::to_value(analyze(&readings))?
        };
        println!("{}", serde_json::to_string_pretty(&value)?);
        return Ok(());
    }

    execute_command(command, |device_index| {
        let (config, db_path) = load_config(debug_mode);
        cmd_sync(&config, &db_path, device_index)
    })
}

fn execute_command<F>(command: Command, sync: F) -> Result<(), AccuChekError>
where
    F: FnOnce(Option<usize>) -> Result<(), AccuChekError>,
{
    match command {
        Command::Guidance => print_desktop_guidance(),
        Command::Sync(device_index) => return sync(device_index),
        Command::Help => print_help(),
        Command::Version => println!("accuchek {}", env!("CARGO_PKG_VERSION")),
        Command::Paths => cmd_show_paths(),
        Command::Data(_) | Command::Analyze(_) => unreachable!("handled before execution"),
    }

    Ok(())
}

fn initialize_logging(debug_mode: bool) {
    if debug_mode {
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
            .format_timestamp(None)
            .init();
    }
}

fn load_config(debug_mode: bool) -> (Config, String) {
    if let Err(error) = ensure_data_dir() {
        eprintln!("Warning: Could not create data directory: {error}");
    }

    let path = config_file_path();
    if !path.exists() {
        if let Err(error) = Config::create_default(&path) {
            if debug_mode {
                warn!("Could not create default config: {error}");
            }
        }
    }

    let config = Config::load(config_file_path())
        .or_else(|_| Config::load("config.txt"))
        .unwrap_or_else(|error| {
            if debug_mode {
                warn!("Could not load config: {error}. Using defaults.");
            }
            Config::default()
        });
    let db_path = config
        .database_path
        .clone()
        .unwrap_or_else(|| default_database_path().to_string_lossy().into_owned());

    (config, db_path)
}

fn cmd_show_paths() {
    println!("Accu-Chek Data Paths:");
    println!("  Data directory:  {}", get_data_dir().display());
    println!("  Database:        {}", default_database_path().display());
    println!("  Config file:     {}", config_file_path().display());
    println!("  Export default:  {}", default_export_dir().display());
}

fn filter_period(
    readings: Vec<crate::storage::StoredReading>,
    period: &str,
) -> Result<Vec<crate::storage::StoredReading>, AccuChekError> {
    use chrono::{Duration, Local, NaiveDate};
    let today = Local::now().date_naive();
    let start: Option<NaiveDate> = match period {
        "all" => None,
        "yesterday" => Some(today - Duration::days(1)),
        "last-week" | "7d" => Some(today - Duration::days(7)),
        "30d" => Some(today - Duration::days(30)),
        value => Some(NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| {
            AccuChekError::InvalidArguments(format!(
                "invalid period '{value}': use yesterday, last-week, 30d, all, or YYYY-MM-DD"
            ))
        })?),
    };
    Ok(readings
        .into_iter()
        .filter(|reading| {
            let date = reading
                .timestamp
                .get(0..10)
                .and_then(|value| NaiveDate::parse_from_str(value, "%Y-%m-%d").ok());
            match (period, start, date) {
                ("yesterday", Some(day), Some(date)) => date == day,
                (_, Some(day), Some(date)) => date >= day && date <= today,
                (_, None, _) => true,
                _ => false,
            }
        })
        .collect())
}

fn cmd_sync(
    config: &Config,
    db_path: &str,
    device_index: Option<usize>,
) -> Result<(), AccuChekError> {
    info!("Starting Accu-Chek downloader");
    let summary = sync_device(config, db_path, device_index)?;
    let downloaded_count = summary.readings.len();
    info!(
        "Imported {} new readings ({} from device, {} total in database)",
        summary.imported_count, downloaded_count, summary.total_count
    );
    eprintln!("Downloaded {downloaded_count} readings from device");
    eprintln!("  New entries:     {}", summary.imported_count);
    eprintln!("  Duplicates:      {} (skipped)", summary.duplicate_count());
    eprintln!("  Total in DB:     {}", summary.total_count);
    eprintln!("Saved to: {}", summary.database_path);
    println!("{}", serde_json::to_string_pretty(&summary.readings)?);
    eprintln!("Export complete!");
    Ok(())
}

fn print_desktop_guidance() {
    println!("AccuChek Local's desktop application lives under desktop/.");
    println!("Run `accuchek --help` for backend CLI commands.");
}

fn print_help() {
    eprintln!(
        "Accu-Chek USB Data Downloader v{}",
        env!("CARGO_PKG_VERSION")
    );
    eprintln!();
    eprintln!("USAGE:");
    eprintln!("  accuchek                    Show desktop application guidance");
    eprintln!("  accuchek sync [device_idx]  Download from device (CLI mode)");
    eprintln!("  accuchek path               Show data file locations");
    eprintln!("  accuchek data [period]      Export stable JSON readings");
    eprintln!("  accuchek analyze [period]   Export pattern analysis JSON");
    eprintln!("  accuchek help               Show this help");
    eprintln!();
    eprintln!("ENVIRONMENT:");
    eprintln!("  ACCUCHEK_DBG=1              Enable debug output");
    eprintln!();
    eprintln!("DATA LOCATIONS:");
    eprintln!("  Database:  {}", default_database_path().display());
    eprintln!("  Config:    {}", config_file_path().display());
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;

    use super::{execute_command, parse_args, Command};

    #[test]
    fn parses_supported_commands_and_aliases() {
        let cases = [
            (vec!["accuchek"], Command::Guidance),
            (vec!["accuchek", "--help"], Command::Help),
            (vec!["accuchek", "-h"], Command::Help),
            (vec!["accuchek", "help"], Command::Help),
            (vec!["accuchek", "--version"], Command::Version),
            (vec!["accuchek", "-V"], Command::Version),
            (vec!["accuchek", "path"], Command::Paths),
            (vec!["accuchek", "paths"], Command::Paths),
            (vec!["accuchek", "sync"], Command::Sync(None)),
            (vec!["accuchek", "download"], Command::Sync(None)),
            (vec!["accuchek", "sync", "2"], Command::Sync(Some(2))),
        ];

        for (args, expected) in cases {
            assert_eq!(parse_args(args), Ok(expected));
        }
    }

    #[test]
    fn rejects_invalid_device_index() {
        assert_eq!(
            parse_args(["accuchek", "sync", "meter"]),
            Err("invalid device index 'meter': expected a non-negative integer".to_string())
        );
    }

    #[test]
    fn rejects_trailing_arguments_for_every_command() {
        let cases = [
            vec!["accuchek", "--help", "extra"],
            vec!["accuchek", "--version", "extra"],
            vec!["accuchek", "paths", "extra"],
            vec!["accuchek", "sync", "2", "extra"],
        ];

        for args in cases {
            assert!(parse_args(args).is_err());
        }
    }

    #[test]
    fn non_sync_commands_do_not_initialize_sync_dependencies() {
        for command in [
            Command::Guidance,
            Command::Help,
            Command::Version,
            Command::Paths,
        ] {
            let sync_invoked = Cell::new(false);

            execute_command(command, |_| {
                sync_invoked.set(true);
                Ok(())
            })
            .unwrap();

            assert!(!sync_invoked.get());
        }
    }
}
