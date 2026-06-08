const crypto = require('crypto')

const unauthorized = () => ({
	name: 'UnauthorizedError',
	status: 401,
	message: 'Weather write token is missing or invalid',
})

const requireWeatherToken = (req, res, next) => {
	const configuredToken = process.env.WEATHER_WRITE_TOKEN
	const providedToken = req.get('X-Weather-Token')

	if (!configuredToken || !providedToken) {
		return next(unauthorized())
	}

	const configuredBuffer = Buffer.from(configuredToken)
	const providedBuffer = Buffer.from(providedToken)

	if (
		configuredBuffer.length !== providedBuffer.length ||
		!crypto.timingSafeEqual(configuredBuffer, providedBuffer)
	) {
		return next(unauthorized())
	}

	next()
}

module.exports = requireWeatherToken
