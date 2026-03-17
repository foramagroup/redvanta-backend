// src/services/queueService.js
import Queue from "bull";

export const emailQueue = new Queue("emails", process.env.REDIS_URL);

emailQueue.process(async (job) => {
  const { sendEmail } = await import("./emailService.js");
  await sendEmail(job.data);
});
