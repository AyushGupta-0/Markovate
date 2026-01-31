import Joi from 'joi';

export const createUserSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  email: Joi.string().email().required(),
});
