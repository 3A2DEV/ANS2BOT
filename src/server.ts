import { createNodeMiddleware, createProbot } from "probot";
import app from "./app";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config();

// Function to validate configurations
function validateConfig(): {
  appId: string;
  privateKeyPath: string;
  webhookSecret: string;
} {
  const requiredConfigs = {
    APP_ID: process.env.APP_ID,
    PRIVATE_KEY_PATH: process.env.PRIVATE_KEY_PATH,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET
  };

  for (const [key, value] of Object.entries(requiredConfigs)) {
    if (!value) {
      throw new Error(`Missing configuration: ${key}`);
    }
  }

  // Type assertion since we already verified values are not undefined
  return {
    appId: requiredConfigs.APP_ID as string,
    privateKeyPath: requiredConfigs.PRIVATE_KEY_PATH as string,
    webhookSecret: requiredConfigs.WEBHOOK_SECRET as string
  };
}

try {
  // Verify configurations
  const config = validateConfig();

  // Read private key
  const privateKeyPath = path.resolve(config.privateKeyPath);
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Private key file not found: ${privateKeyPath}`);
  }
  
  const privateKey = fs.readFileSync(privateKeyPath, "utf-8");

  // Create Probot instance with required configurations
  const probot = createProbot({
    defaults: {
      appId: parseInt(config.appId, 10),
      privateKey,
      secret: config.webhookSecret,
    }
  });

  // Create Express middleware
  const middleware = createNodeMiddleware(app, {
    probot,
    webhooksPath: "/api/github/webhooks",
  });

  // Start server
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  require("http")
    .createServer(middleware)
    .listen(port, () => {
      console.log("🤖 ANS2BOT is running!");
      console.log(`🚀 Server listening on port ${port}`);
      console.log(`📦 App ID: ${config.appId}`);
      console.log(`🔑 Private Key: ${privateKeyPath}`);
      console.log(`🔒 Webhook Secret configured: ${Boolean(config.webhookSecret)}`);
    });

} catch (error) {
  if (error instanceof Error) {
    console.error("❌ Error starting bot:", error.message);
  } else {
    console.error("❌ Unknown error starting bot");
  }
  process.exit(1);
}