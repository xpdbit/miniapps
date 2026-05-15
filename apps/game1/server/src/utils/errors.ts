export class AppError extends Error {
  constructor(
    public errCode: number,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(2001, message, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '未授权访问') {
    super(1001, message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '权限不足') {
    super(1003, message, 403);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends AppError {
  constructor(message = '参数验证失败') {
    super(2002, message, 400);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message = '数据冲突') {
    super(2003, message, 409);
    this.name = 'ConflictError';
  }
}
