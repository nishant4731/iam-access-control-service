import { Field, InputType, OmitType, PartialType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';
import { CreateUserInput } from './create-user.input';

/**
 * Update mutable user attributes. Derived from CreateUserInput via mapped types
 * (no duplicated field definitions):
 *   • OmitType   — password (changed via a dedicated flow) and managerId
 *                  (changed via assignManager, which maintains the closure table).
 *   • PartialType — every remaining field becomes optional for a patch update.
 * `id` is added back as the required target.
 */
@InputType()
export class UpdateUserInput extends PartialType(
  OmitType(CreateUserInput, ['password', 'managerId'] as const),
) {
  @Field(() => String)
  @IsUUID()
  id!: string;
}
