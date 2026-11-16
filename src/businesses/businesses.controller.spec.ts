import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { BusinessesController } from './businesses.controller';

/**
 * Guests must be able to browse storefronts, while ownership-scoped routes and
 * every mutation stay behind the JWT guard. The guard itself reads
 * `IS_PUBLIC_KEY` from each handler, so asserting the metadata is enough.
 */
describe('BusinessesController route visibility', () => {
  const isPublic = (handler: keyof BusinessesController) =>
    Reflect.getMetadata(IS_PUBLIC_KEY, BusinessesController.prototype[handler]) === true;

  it.each(['list', 'trending', 'bySlug', 'byId'] as const)('%s is public', (handler) => {
    expect(isPublic(handler)).toBe(true);
  });

  it.each(['mine', 'create', 'update', 'remove'] as const)('%s requires auth', (handler) => {
    expect(isPublic(handler)).toBe(false);
  });
});
