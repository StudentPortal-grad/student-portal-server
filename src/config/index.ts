import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';
import { fileURLToPath } from 'url';

// Define __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Define validation schema
const envVarsSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),
    DB_URI: Joi.string().required().description('MongoDB connection URI'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_EXPIRES_IN: Joi.string().default('7d').description('JWT token expiration'),

    CHATBOT_EMAIL: Joi.string().email().description('Email for the chatbot user'),
    CHATBOT_NAME: Joi.string().description('Name for the chatbot user'),
    CHATBOT_AVATAR: Joi.string().uri().description('Avatar URL for the chatbot user'),
    AI_API_URL: Joi.string().uri().description('URL for the AI API'),
    AI_API_KEY: Joi.string().description('API key for the AI service'),

    CLOUDINARY_CLOUD_NAME: Joi.string().required().description('Cloudinary cloud name'),
    CLOUDINARY_API_KEY: Joi.string().required().description('Cloudinary API key'),
    CLOUDINARY_API_SECRET: Joi.string().required().description('Cloudinary API secret'),

    MAILER_HOST: Joi.string().required().description('Email service host'),
    MAILER_PORT: Joi.number().required().description('Email service port'),
    MAILER_USER: Joi.string().required().description('Email service user'),
    MAILER_PASS: Joi.string().required().description('Email service password'),
    MAILER_SECURE: Joi.boolean().description('Email service secure connection'),
}).unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    mongoose: {
        url: envVars.DB_URI,
    },
    jwt: {
        secret: envVars.JWT_SECRET,
        expiresIn: envVars.JWT_EXPIRES_IN,
    },
    chatbot: {
        email: envVars.CHATBOT_EMAIL,
        name: envVars.CHATBOT_NAME,
        avatar: envVars.CHATBOT_AVATAR,
    },
    aiApi: {
        url: envVars.AI_API_URL,
        key: envVars.AI_API_KEY,
        chatbotApiUrl: envVars.CHATBOT_API_URL,
    },
    cloudinary: {
        cloud_name: envVars.CLOUDINARY_CLOUD_NAME,
        api_key: envVars.CLOUDINARY_API_KEY,
        api_secret: envVars.CLOUDINARY_API_SECRET,
    },
    email: {
        host: envVars.MAILER_HOST,
        port: envVars.MAILER_PORT,
        user: envVars.MAILER_USER,
        pass: envVars.MAILER_PASS,
        secure: envVars.MAILER_SECURE,
    },
};
