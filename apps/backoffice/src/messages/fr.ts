// Labels of the backoffice. D36 is open: French only, without next-intl (02 §8, 21 §4 J1-E).
// No literal text in JSX: moving to two languages will only replace this module.
export const messages = {
  metadata: {
    title: "INFLUX — Backoffice",
  },
  login: {
    title: "Connexion",
    restricted: "Accès réservé à l’équipe INFLUX.",
  },
} as const;
