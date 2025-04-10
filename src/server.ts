import { createNodeMiddleware, createProbot } from "probot";
import app from "./app";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Carica le variabili d'ambiente
dotenv.config();

// Funzione per verificare le configurazioni
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
      throw new Error(`Configurazione mancante: ${key}`);
    }
  }

  // Type assertion perché abbiamo già verificato che i valori non sono undefined
  return {
    appId: requiredConfigs.APP_ID as string,
    privateKeyPath: requiredConfigs.PRIVATE_KEY_PATH as string,
    webhookSecret: requiredConfigs.WEBHOOK_SECRET as string
  };
}

try {
  // Verifica le configurazioni
  const config = validateConfig();

  // Leggi la private key
  const privateKeyPath = path.resolve(config.privateKeyPath);
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`File private key non trovato: ${privateKeyPath}`);
  }
  
  const privateKey = fs.readFileSync(privateKeyPath, "utf-8");

  // Crea un'istanza di Probot con le configurazioni necessarie
  const probot = createProbot({
    defaults: {
      appId: parseInt(config.appId, 10),
      privateKey,
      secret: config.webhookSecret,
    }
  });

  // Crea il middleware Express
  const middleware = createNodeMiddleware(app, {
    probot,
    webhooksPath: "/api/github/webhooks",
  });

  // Avvia il server
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  require("http")
    .createServer(middleware)
    .listen(port, () => {
      console.log("🤖 ANS2BOT è in esecuzione!");
      console.log(`🚀 Server in ascolto sulla porta ${port}`);
      console.log(`📦 App ID: ${config.appId}`);
      console.log(`🔑 Private Key: ${privateKeyPath}`);
      console.log(`🔒 Webhook Secret configurato: ${Boolean(config.webhookSecret)}`);
    });

} catch (error) {
  if (error instanceof Error) {
    console.error("❌ Errore durante l'avvio del bot:", error.message);
  } else {
    console.error("❌ Errore sconosciuto durante l'avvio del bot");
  }
  process.exit(1);
}