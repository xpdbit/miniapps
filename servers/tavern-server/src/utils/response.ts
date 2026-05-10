import { ApiResponse } from '../types';

export function success<T>(data: T, message = '操作成功'): ApiResponse<T> {
  return {
    code: 0,
    data,
    message,
  };
}

export function error(code: number, message: string): ApiResponse<null> {
  return {
    code,
    data: null,
    message,
  };
}
