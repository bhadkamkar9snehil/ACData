//! Command-line entry point for the Accu-Chek backend.

use std::env;

use log::{info, warn};

use crate::config::{
    config_file_path, default_database_path, default_export_dir, ensure_data_dir, get_data_dir,
    Config,
};
use crate::device::find_and_download_accuchek;
use crate::error::AccuChekError;
use crate::storage::Storage;

#[derive(Debug, PartialEq)]
enum Command {
    Guidance,
    Sync(Option<usize>),
    Help,
    Version,
    Paths,
}

fn parse_args<I, S>(args: I) -> Result<Command, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut args = args.into_iter();
    let _program = args.next();

    match args.next().as_ref().map(AsRef::as_ref) {
        None => Ok(Command::Guidance),
        Some("sync" | "download") => parse_sync(args.next().as_ref().map(AsRef::as_ref)),
        Some("--help" | "-h" | "help") => Ok(Command::Help),
        Some("--version" | "-V") => Ok(Command::Version),
        Some("path" | "paths") => Ok(Command::Paths),
        Some(argument) => Err(format!("unknown command '{argument}'")),
    }
}

fn parse_sync(device_index: Option<&str>) -> Result<Command, String> {
    let Some(device_index) = device_index else {
        return Ok(Command::Sync(None));
    };

    device_index
        .parse()
        .map(|index| Command::Sync(Some(index)))
        .map_err(|_| {
            format!("invalid device index '{device_index}': expected a non-negative integer")
        })
}

/// Run the command-line application.
pub fn run() -> Result<(), AccuChekError> {
    let args: Vec<String> = env::args().collect();
    if args.len() > 1 {
        attach_console();
    }

    let command = parse_args(&args).map_err(|message| {
        AccuChekError::Communication(format!("CLI argument error: {message}"))
    })?;
    let debug_mode = env::var("ACCUCHEK_DBG").is_ok();
    initialize_logging(debug_mode);
    let (config, db_path) = load_config(debug_mode);

    match command {
        Command::Guidance => print_desktop_guidance(),
        Command::Sync(device_index) => cmd_sync(&config, &db_path, device_index)?,
        Command::Help => print_help(),
        Command::Version => println!("accuchek {}", env!("CARGO_PKG_VERSION")),
        Command::Paths => cmd_show_paths(),
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

fn cmd_sync(
    config: &Config,
    db_path: &str,
    device_index: Option<usize>,
) -> Result<(), AccuChekError> {
    #[cfg(unix)]
    check_root_privileges()?;

    info!("Starting Accu-Chek downloader");
    let context = rusb::Context::new()?;
    let download = find_and_download_accuchek(&context, config, device_index)?;
    let storage = Storage::new(db_path)?;
    storage.upsert_device(&download.device)?;
    let readings = download.readings;
    let new_count = storage.import_readings(&readings)?;
    let total_count = storage.count()?;

    info!(
        "Imported {} new readings ({} from device, {} total in database)",
        new_count,
        readings.len(),
        total_count
    );
    eprintln!("Downloaded {} readings from device", readings.len());
    eprintln!("  New entries:     {new_count}");
    eprintln!(
        "  Duplicates:      {} (skipped)",
        readings.len() - new_count
    );
    eprintln!("  Total in DB:     {total_count}");
    eprintln!("Saved to: {db_path}");
    println!("{}", serde_json::to_string_pretty(&readings)?);
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
    eprintln!("  accuchek help               Show this help");
    eprintln!();
    eprintln!("ENVIRONMENT:");
    eprintln!("  ACCUCHEK_DBG=1              Enable debug output");
    eprintln!();
    eprintln!("DATA LOCATIONS:");
    eprintln!("  Database:  {}", default_database_path().display());
    eprintln!("  Config:    {}", config_file_path().display());
}

#[cfg(windows)]
fn attach_console() {
    #[link(name = "kernel32")]
    extern "system" {
        fn AttachConsole(process_id: u32) -> i32;
    }

    #[link(name = "msvcrt")]
    extern "C" {
        fn freopen(
            filename: *const i8,
            mode: *const i8,
            stream: *mut std::ffi::c_void,
        ) -> *mut std::ffi::c_void;
        fn __acrt_iob_func(index: u32) -> *mut std::ffi::c_void;
    }

    const ATTACH_PARENT_PROCESS: u32 = 0xFFFF_FFFF;

    unsafe {
        if AttachConsole(ATTACH_PARENT_PROCESS) != 0 {
            let conout = c"CONOUT$".as_ptr();
            let mode = c"w".as_ptr();
            freopen(conout, mode, __acrt_iob_func(1));
            freopen(conout, mode, __acrt_iob_func(2));
        }
    }
}

#[cfg(not(windows))]
fn attach_console() {}

#[cfg(unix)]
fn check_root_privileges() -> Result<(), AccuChekError> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{parse_args, Command};

    #[test]
    fn parses_help() {
        assert_eq!(parse_args(["accuchek", "--help"]), Ok(Command::Help));
    }

    #[test]
    fn parses_version() {
        assert_eq!(parse_args(["accuchek", "--version"]), Ok(Command::Version));
    }

    #[test]
    fn parses_paths() {
        assert_eq!(parse_args(["accuchek", "paths"]), Ok(Command::Paths));
    }

    #[test]
    fn dispatches_sync_with_device_index() {
        assert_eq!(
            parse_args(["accuchek", "sync", "2"]),
            Ok(Command::Sync(Some(2)))
        );
    }

    #[test]
    fn rejects_invalid_device_index() {
        assert_eq!(
            parse_args(["accuchek", "sync", "meter"]),
            Err("invalid device index 'meter': expected a non-negative integer".to_string())
        );
    }
}
