// A verified event must be stored before acknowledgement. The database worker
// owns retries if the immediate drain fails after that durable write.
export async function acknowledgeStoredPaymentWebhook<T>(
  store: () => Promise<T>,
  drain: () => Promise<unknown>,
  reportDrainFailure: (error: unknown) => void,
): Promise<T> {
  const accepted = await store();
  try {
    await drain();
  } catch (error) {
    reportDrainFailure(error);
  }
  return accepted;
}
