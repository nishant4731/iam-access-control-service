import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PaginationArgs, toPrismaPagination } from '../common/dto/pagination.args';
import { CreateServiceIdentityInput } from './dto/create-service-identity.input';
import { ServiceIdentity, ServiceIdentityWithKey } from './entities/service-identity.entity';
import { ServiceIdentityMapper } from './service-identity.mapper';
import { ServiceIdentitiesRepository } from './service-identities.repository';

/** The authenticated result of validating a service API key. */
export interface ServicePrincipal {
  id: string;
  tenantId: string;
  name: string;
}

const BCRYPT_ROUNDS = 10;

/**
 * Provisions and authenticates service-to-service callers.
 *
 * An API key has the form `<serviceIdentityId>.<secret>`. Only a bcrypt hash of
 * the secret is stored; the plaintext is shown exactly once at creation time.
 */
@Injectable()
export class ServiceIdentitiesService {
  constructor(private readonly repository: ServiceIdentitiesRepository) {}

  async create(
    tenantId: string,
    input: CreateServiceIdentityInput,
  ): Promise<ServiceIdentityWithKey> {
    const secret = randomBytes(24).toString('hex');
    const apiKeyHash = await bcrypt.hash(secret, BCRYPT_ROUNDS);

    const model = await this.repository.create({
      name: input.name,
      apiKeyHash,
      tenant: { connect: { id: tenantId } },
    });

    return {
      serviceIdentity: ServiceIdentityMapper.toEntity(model),
      apiKey: `${model.id}.${secret}`,
    };
  }

  /**
   * Validates a raw `<id>.<secret>` API key. Returns the service principal
   * (with its tenant) or null. Never throws on bad input.
   */
  async validateApiKey(rawKey: string): Promise<ServicePrincipal | null> {
    const separator = rawKey.indexOf('.');
    if (separator <= 0) {
      return null;
    }
    const id = rawKey.slice(0, separator);
    const secret = rawKey.slice(separator + 1);
    if (!secret) {
      return null;
    }

    const identity = await this.repository.findByIdGlobal(id);
    if (!identity || !identity.enabled) {
      return null;
    }

    const ok = await bcrypt.compare(secret, identity.apiKeyHash);
    if (!ok) {
      return null;
    }

    return { id: identity.id, tenantId: identity.tenantId, name: identity.name };
  }

  async findAll(tenantId: string, pagination?: PaginationArgs): Promise<ServiceIdentity[]> {
    const { take, skip } = toPrismaPagination(pagination);
    return ServiceIdentityMapper.toEntities(await this.repository.findMany(tenantId, take, skip));
  }
}
