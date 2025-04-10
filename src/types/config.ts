export interface BotConfig {
  bot: {
    commands: Command[];
    components: {
      paths: { [key: string]: string };
    };
    maintainers: { [key: string]: string[] };
    labels?: { [key: string]: LabelConfig };
  };
}

export interface Command {
  name: string;
  description: string;
  usage: string;
}

export interface LabelConfig {
  color: string;
  description: string;
}