declare module "meteor/percolate:migrations" {
  export type MigrationsOptions = {
    log?: boolean;
    logger?:
      | null
      | ((prop: { level: string; message: string; tag: string }) => void);
    logIfLatest?: boolean;
    collectionName?: string;
  };
  export type Control = {
    version: number;
    locked: boolean;
  };
  export namespace Migrations {
    const options: MigrationsOptions;
    function config(options: MigrationsOptions): void;
    function add(migration: {
      version: number;
      up: () => Promise<void>;
      down?: () => Promise<void>;
    }): void;
    function migrateTo(version: string): Promise<void>;
    function getVersion(): Promise<number>;

    function _migrateTo(version: string, rerun: boolean): Promise<void>;
    function _getControl(): Promise<Control>;
    function _setControl(control: Control): Promise<Control>;
    function _findIndexByVersion(): number;
    function _reset(): Promise<number>;
    function unlock(): Promise<number>;
  }
}
