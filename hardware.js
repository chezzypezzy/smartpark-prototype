// Only if using Raspberry Pi with GPIO
const Gpio = require('onoff').Gpio;
const led = new Gpio(18, 'out'); // GPIO 18

function openGate() {
  console.log("🟢 GATE OPENED (LED ON)");
  led.writeSync(1);
  setTimeout(() => led.writeSync(0), 5000); // Turn off after 5s
}

module.exports = { openGate };