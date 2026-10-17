declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    NICRRON_API_KEY?: string;
    NICRRON_MODEL?: string;
    PRISM_API_KEY?: string;
    PRISM_PROJECT_ID?: string;
    PRISM_AGENT_ID?: string;
    PRISM_ENFORCE?: string;
    PRISM_HOST?: string;
  }
}
