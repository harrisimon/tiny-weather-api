const axios = require('axios')
const BME280 = require('bme280-sensor')

const apiUrl = process.env.WEATHER_API_URL || 'https://tinyweather.fly.dev/weather'
const writeToken = process.env.WEATHER_WRITE_TOKEN
const deviceId = process.env.WEATHER_DEVICE_ID || 'raspberry-pi'

if (!writeToken) {
	console.error('Missing WEATHER_WRITE_TOKEN')
	process.exit(1)
}

const options = {
	i2cBusNo: 1,
	i2cAddress: BME280.BME280_DEFAULT_I2C_ADDRESS(),
}

const bme280 = new BME280(options)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const postWithRetry = async (payload, attempts = 3) => {
	let lastError

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await axios.post(apiUrl, payload, {
				timeout: 10000,
				headers: {
					'X-Weather-Token': writeToken,
				},
			})
		} catch (error) {
			lastError = error

			if (attempt < attempts) {
				await sleep(1000 * attempt)
			}
		}
	}

	throw lastError
}

bme280.init()
	.then(() => bme280.readSensorData())
	.then((data) => {
		const payload = {
			weather: {
				temperature: data.temperature_C,
				pressure: data.pressure_hPa,
				humidity: data.humidity,
				measuredAt: new Date().toISOString(),
				deviceId,
			},
		}

		console.log(`Sensor data: ${JSON.stringify(payload.weather, null, 2)}`)

		return postWithRetry(payload)
	})
	.then((response) => {
		console.log(`Data sent successfully: ${response.status}`)
		process.exit(0)
	})
	.catch((err) => {
		const status = err.response && err.response.status
		const body = err.response && err.response.data
		console.error('Error:', status || err.message, body || '')
		process.exit(1)
	})
