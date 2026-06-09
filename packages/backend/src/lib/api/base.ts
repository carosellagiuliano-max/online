import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../db/client';
import type { Database } from '../db/types';
import { logger } from '../logging/logger';

// ============================================
// TYPES
// ============================================

export type TableName = keyof Database['public']['Tables'];

export interface ServiceResult<T> {
  data: T | null;
  error: ServiceError | null;
}

export interface ServiceListResult<T> {
  data: T[];
  count: number | null;
  error: ServiceError | null;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  [key: string]: unknown;
}

// ============================================
// BASE SERVICE CLASS
// ============================================

export abstract class BaseService<T extends TableName> {
  protected client: any;
  protected tableName: T;

  constructor(tableName: T, client?: any) {
    this.tableName = tableName;
    this.client = client || supabase;
  }

  // ============================================
  // ERROR HANDLING
  // ============================================

  protected handleError(error: PostgrestError): ServiceError {
    logger.error(`Database error in ${this.tableName}:`, error, {
      code: error.code,
      details: error.details,
    });

    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: this.mapErrorMessage(error),
      details: error.details || undefined,
    };
  }

  protected mapErrorMessage(error: PostgrestError): string {
    switch (error.code) {
      case '23505':
        return 'Ein Eintrag mit diesen Daten existiert bereits.';
      case '23503':
        return 'Der referenzierte Datensatz existiert nicht.';
      case '42501':
        return 'Keine Berechtigung für diese Aktion.';
      case 'PGRST116':
        return 'Eintrag nicht gefunden.';
      default:
        return error.message || 'Ein unerwarteter Fehler ist aufgetreten.';
    }
  }

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  async findById(id: string): Promise<ServiceResult<any>> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data, error: null };
  }

  async findMany(
    options: {
      filters?: FilterParams;
      pagination?: PaginationParams;
      sort?: SortParams;
      select?: string;
    } = {}
  ): Promise<ServiceListResult<any>> {
    const { filters, pagination, sort, select = '*' } = options;

    let query = this.client.from(this.tableName).select(select, { count: 'exact' });

    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object' && 'operator' in value) {
            const { operator, operand } = value as { operator: string; operand: unknown };
            switch (operator) {
              case 'eq':
                query = query.eq(key, operand);
                break;
              case 'neq':
                query = query.neq(key, operand);
                break;
              case 'gt':
                query = query.gt(key, operand);
                break;
              case 'gte':
                query = query.gte(key, operand);
                break;
              case 'lt':
                query = query.lt(key, operand);
                break;
              case 'lte':
                query = query.lte(key, operand);
                break;
              case 'like':
                query = query.like(key, operand as string);
                break;
              case 'ilike':
                query = query.ilike(key, operand as string);
                break;
              case 'in':
                query = query.in(key, operand as unknown[]);
                break;
            }
          } else {
            query = query.eq(key, value);
          }
        }
      });
    }

    // Apply sorting
    if (sort?.sortBy) {
      query = query.order(sort.sortBy, {
        ascending: sort.sortOrder !== 'desc',
      });
    }

    // Apply pagination
    if (pagination) {
      const { page = 1, pageSize = 20, offset, limit } = pagination;
      const start = offset ?? (page - 1) * pageSize;
      const end = start + (limit ?? pageSize) - 1;
      query = query.range(start, end);
    }

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return {
      data: data || [],
      count,
      error: null,
    };
  }

  async create(input: any): Promise<ServiceResult<any>> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert(input)
      .select()
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data, error: null };
  }

  async update(
    id: string,
    input: any
  ): Promise<ServiceResult<any>> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data, error: null };
  }

  async delete(id: string): Promise<ServiceResult<boolean>> {
    const { error } = await this.client.from(this.tableName).delete().eq('id', id);

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: true, error: null };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  async exists(id: string): Promise<boolean> {
    const { data } = await this.client
      .from(this.tableName)
      .select('id')
      .eq('id', id)
      .single();

    return !!data;
  }

  async count(filters?: FilterParams): Promise<number> {
    let query = this.client.from(this.tableName).select('*', { count: 'exact', head: true });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    const { count } = await query;
    return count || 0;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function createFilter(operator: string, operand: unknown) {
  return { operator, operand };
}

export const eq = (value: unknown) => createFilter('eq', value);
export const neq = (value: unknown) => createFilter('neq', value);
export const gt = (value: unknown) => createFilter('gt', value);
export const gte = (value: unknown) => createFilter('gte', value);
export const lt = (value: unknown) => createFilter('lt', value);
export const lte = (value: unknown) => createFilter('lte', value);
export const like = (value: string) => createFilter('like', value);
export const ilike = (value: string) => createFilter('ilike', value);
export const inArray = (values: unknown[]) => createFilter('in', values);
