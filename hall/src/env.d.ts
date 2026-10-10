/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The repository on GitHub, set by the Pages workflow, for links to each simulation's docs. */
  readonly VITE_REPO_URL?: string;
}
