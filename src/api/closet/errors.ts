export function isClosetServiceUnavailable(error: unknown) {
  const response = (
    error as { response?: { status?: number; data?: { code?: string } } }
  )?.response;
  return (
    response?.status === 503 ||
    response?.data?.code === "CLOSET_SERVICE_UNAVAILABLE"
  );
}
