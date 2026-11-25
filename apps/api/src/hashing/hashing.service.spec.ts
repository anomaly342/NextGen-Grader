import { Test, TestingModule } from '@nestjs/testing';
import { BCRYPT_SALT_ROUNDS } from '@/bcrypt/bcrypt.constants';
import { BcryptService } from '@/bcrypt/bcrypt.service';
import { DUMMY_PASSWORD_HASH } from './hashing.constants';
import { HashingModule } from './hashing.module';
import { HashingService } from './hashing.service';

describe('HashingService', () => {
  const inputPassword = 'correct horse battery staple';
  let service: HashingService;
  let bcryptService: BcryptService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HashingModule],
    }).compile();
    service = module.get(HashingService);
    bcryptService = module.get(BcryptService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies the right password against its own hash', async () => {
    const inputHash = await service.hash(inputPassword);
    await expect(service.verify(inputPassword, inputHash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const inputHash = await service.hash(inputPassword);
    await expect(service.verify('wrong password', inputHash)).resolves.toBe(
      false,
    );
  });

  it('rejects a missing hash after running bcrypt against the dummy hash', async () => {
    const mockVerify = jest.spyOn(bcryptService, 'verify');
    await expect(service.verify(inputPassword, null)).resolves.toBe(false);
    expect(mockVerify).toHaveBeenCalledWith(inputPassword, DUMMY_PASSWORD_HASH);
  });

  it('rejects a missing hash even if the dummy hash were to match', async () => {
    jest.spyOn(bcryptService, 'verify').mockResolvedValue(true);
    await expect(service.verify(inputPassword, null)).resolves.toBe(false);
  });

  it('keeps the dummy hash at the same cost as real hashes', () => {
    expect(DUMMY_PASSWORD_HASH.startsWith(`$2b$${BCRYPT_SALT_ROUNDS}$`)).toBe(
      true,
    );
  });
});
