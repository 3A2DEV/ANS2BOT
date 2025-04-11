import { Probot } from "probot";
import app from "./app";

// Export function to accept Probot istance
export = (robot: Probot) => {
  robot.load(app);
};