import { z } from 'zod';

export interface ToolParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'body';
  required: boolean;
  schema: {
    type: string;
    description?: string;
  };
  description?: string;
}

export interface ToolSchema {
  operationId: string;
  parameters?: ToolParameter[];
}

export interface ToolConfiguration {
  name: string;
  description: string;
  endpoint: string;
  schema: ToolSchema;
}

export type ToolConfigs = {
  [key: string]: ToolConfiguration;
};
