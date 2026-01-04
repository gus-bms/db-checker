export type Env = {
  DB_HOST: string;
  DB_PORT?: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;

  DB_POOL_LIMIT?: string;
  DB_CONNECT_TIMEOUT_MS?: string;
  DB_QUERY_TIMEOUT_MS?: string;
};
