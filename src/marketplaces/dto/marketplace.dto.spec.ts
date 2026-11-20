import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MarketplaceTimingDto, CreateMarketplaceDto } from './marketplace.dto';

function toTiming(value: Record<string, unknown>): MarketplaceTimingDto {
  return plainToInstance(MarketplaceTimingDto, value);
}

function errorsFor(timing: MarketplaceTimingDto) {
  return validate(timing, { whitelist: true }).then((errors) =>
    errors.map((error) => error.property),
  );
}

describe('MarketplaceTimingDto', () => {
  it('accepts an open day with 24h hours', async () => {
    const timing = toTiming({ day: 'monday', open: '09:30', close: '21:00' });
    await expect(errorsFor(timing)).resolves.toEqual([]);
  });

  it('accepts a closed day without hours', async () => {
    const timing = toTiming({ day: 'sunday', closed: true });
    await expect(errorsFor(timing)).resolves.toEqual([]);
  });

  it('accepts a closed day that still carries hours', async () => {
    const timing = toTiming({ day: 'sunday', closed: true, open: '', close: '' });
    await expect(errorsFor(timing)).resolves.toEqual([]);
  });

  it('rejects missing hours on an open day', async () => {
    const timing = toTiming({ day: 'monday' });
    await expect(errorsFor(timing)).resolves.toEqual(
      expect.arrayContaining(['open', 'close']),
    );
  });

  it('rejects a non-24h hour on an open day', async () => {
    const timing = toTiming({ day: 'monday', open: '9:30 am', close: '21:00' });
    await expect(errorsFor(timing)).resolves.toContain('open');
  });
});

describe('CreateMarketplaceDto timings', () => {
  it('validates nested timings, including a closed day without hours', async () => {
    const dto = plainToInstance(CreateMarketplaceDto, {
      name: 'Corner Store',
      timings: [
        { day: 'monday', open: '09:00', close: '18:00' },
        { day: 'sunday', closed: true },
      ],
    });

    const errors = await validate(dto, { whitelist: true });
    expect(errors).toEqual([]);
  });
});
