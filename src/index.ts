import { Probot } from "probot";
import app from "./app";

// Esporta una funzione che accetta un'istanza di Probot
export = (robot: Probot) => {
  robot.load(app);
};