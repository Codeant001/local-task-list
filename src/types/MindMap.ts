export interface MindMapNode {
  id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'todo' | 'in_progress' | 'done';
  created_at: string;
  start_date?: string;
  due_date?: string;
  tags?: string[];
  children?: MindMapNode[];
  edgeLabel?: string;
}

export interface MindMapTheme {
  id: string;
  title: string;
  children?: MindMapNode[];
  created_at: string;
  updated_at?: string;
  start_date?: string;
  due_date?: string;
  metadata?: {
    version: string;
    theme: string;
  };
}

export interface MindMapData {
  mindMaps: MindMapTheme[];
} 