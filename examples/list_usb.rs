use rusb::UsbContext;

fn main() -> Result<(), rusb::Error> {
    let context = rusb::Context::new()?;
    for device in context.devices()?.iter() {
        match device.device_descriptor() {
            Ok(descriptor) => println!(
                "bus={} address={} {:04x}:{:04x} configurations={}",
                device.bus_number(),
                device.address(),
                descriptor.vendor_id(),
                descriptor.product_id(),
                descriptor.num_configurations()
            ),
            Err(error) => println!("bus={} address={} descriptor error: {error}", device.bus_number(), device.address()),
        }
    }
    Ok(())
}
