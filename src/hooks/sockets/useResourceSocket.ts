import { useEffect, useRef } from "react";
import { useSocket } from "../../context/SocketContext";
import { useRoomStore } from "../../store/roomStore";
import { Resource } from "../../store/roomStore";

export interface ResourceSocketOptions {
  onResourceAdded?: (resource: Resource) => void;
}

export function useResourceSocket(options?: ResourceSocketOptions) {
  const { socket } = useSocket();
  const mergeResources = useRoomStore((state) => state.mergeResources);
  const setResources = useRoomStore((state) => state.setResources);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!socket) return;

    const handleResourceAdded = (resource: Resource) => {
      mergeResources([resource]);
      if (optionsRef.current?.onResourceAdded) {
        optionsRef.current.onResourceAdded(resource);
      }
    };

    const handleResourceUpdated = (resource: Resource) => {
      mergeResources([resource]);
    };

    const handleResourceRemoved = ({ id }: { id: string }) => {
      setResources(useRoomStore.getState().resources.filter((r) => r.id !== id));
    };

    socket.on("RESOURCE_ADDED", handleResourceAdded);
    socket.on("RESOURCE_UPDATED", handleResourceUpdated);
    socket.on("RESOURCE_REMOVED", handleResourceRemoved);

    return () => {
      socket.off("RESOURCE_ADDED", handleResourceAdded);
      socket.off("RESOURCE_UPDATED", handleResourceUpdated);
      socket.off("RESOURCE_REMOVED", handleResourceRemoved);
    };
  }, [socket, mergeResources, setResources]);
}
