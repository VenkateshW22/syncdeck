import { redisClient } from "../utils/redis";
import { v4 as uuidv4 } from "uuid";
import { ResourceTypeType } from "../../src/types";

export interface ResourcePayload {
  type: ResourceTypeType;
  title?: string;
  description?: string;
  metadata: any;
}

export class ResourceService {
  async addResource(
    roomId: string,
    createdBy: string,
    payload: ResourcePayload,
  ) {
    const resourceId = uuidv4();
    const resource = {
      id: resourceId,
      roomId,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      metadata: payload.metadata,
      createdBy,
      createdAt: new Date().toISOString(),
    };

    await redisClient.hSet(
      `room:${roomId}:resources`,
      resourceId,
      JSON.stringify(resource),
    );

    await redisClient.zAdd(`room:${roomId}:resource_order`, {
      score: Date.now(),
      value: resourceId,
    });

    const TTL = 86400; // 24 hours
    await redisClient.expire(`room:${roomId}:resources`, TTL);
    await redisClient.expire(`room:${roomId}:resource_order`, TTL);

    return resource;
  }

  async updateResource(
    roomId: string,
    resourceId: string,
    payload: Partial<ResourcePayload>
  ) {
    const resourceStr = await redisClient.hGet(`room:${roomId}:resources`, resourceId);
    if (!resourceStr) throw new Error("Resource not found");
    
    const resource = JSON.parse(resourceStr);
    const updatedResource = {
      ...resource,
      ...payload,
      updatedAt: new Date().toISOString()
    };
    
    await redisClient.hSet(
      `room:${roomId}:resources`,
      resourceId,
      JSON.stringify(updatedResource),
    );
    
    return updatedResource;
  }

  async removeResource(roomId: string, resourceId: string) {
    await redisClient.hDel(`room:${roomId}:resources`, resourceId);
    await redisClient.zRem(`room:${roomId}:resource_order`, resourceId);
  }

  async getRoomResources(roomId: string) {
    const resourceIds = await redisClient.zRange(
      `room:${roomId}:resource_order`,
      0,
      -1,
    );
    if (!resourceIds || resourceIds.length === 0) return [];

    const resources = await Promise.all(
      resourceIds.map((id) => redisClient.hGet(`room:${roomId}:resources`, id)),
    );
    return resources
      .map((r) => (r ? JSON.parse(r as string) : null))
      .filter(Boolean);
  }
}
