import { Test, TestingModule } from '@nestjs/testing';
import { BcryptModule } from './bcrypt.module';
import { BcryptService } from './bcrypt.service';

describe('BcryptService', () => {
  const inputPassword = 'correct horse battery staple';
  let service: BcryptService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BcryptModule],
    }).compile();
    service = module.get(BcryptService);
  });

  it('hashes to a bcrypt string, not the plain password', async () => {
    const actualHash = await service.hash(inputPassword);
    expect(actualHash).not.toContain(inputPassword);
    expect(actualHash).toMatch(/^\$2[aby]\$12\$.{53}$/);
  });

  it('uses a new salt each time', async () => {
    const actualFirst = await service.hash(inputPassword);
    const actualSecond = await service.hash(inputPassword);
    expect(actualFirst).not.toBe(actualSecond);
  });

  it('verifies the right password', async () => {
    const inputHash = await service.hash(inputPassword);
    await expect(service.verify(inputPassword, inputHash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const inputHash = await service.hash(inputPassword);
    await expect(service.verify('wrong password', inputHash)).resolves.toBe(
      false,
    );
  });
});
