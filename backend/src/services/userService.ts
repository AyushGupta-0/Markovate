import prisma from '../config/database';
import { AppError } from '../middlewares/errorHandler';

interface CreateUserDTO {
  name: string;
  email: string;
}

export async function createUser(data: CreateUserDTO) {
  try {
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return user;
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'USER_ALREADY_EXISTS', 'User with this email already exists');
    }
    throw error;
  }
}
