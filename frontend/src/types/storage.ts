export interface StorageConnection {
  id: string;
  provider: string;
  account_name: string | null;
  root_folder_id: string | null;
  root_folder_name: string | null;
  is_active: boolean;
}

export interface StorageItem {
  id: string;
  name: string;
  folder: boolean;
  size: number;
}

export interface StorageOperation {
  id: string;
  kind: string;
  status: 'awaiting_authorization' | 'queued' | 'running' | 'completed' | 'failed';
  result: { items?: StorageItem[]; next_cursor?: string | null; connection_id?: string;
    documento_id?: string; content_url?: string; mime_type?: string; name?: string } | null;
  error_code: string | null;
  error_message: string | null;
  expires_at: string;
}

export interface StorageStatus {
  provider: string;
  configured: boolean;
  worker_ready: boolean;
  connection_id: string | null;
  connections: StorageConnection[];
}
