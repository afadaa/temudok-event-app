import { z } from 'zod';

export const RegistrationSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(10),
  npa: z.string().optional(), // Nomor Pokok Anggota IDI
  category: z.string(),
  branchId: z.string().optional(),
  eventId: z.string()
});

export type RegistrationData = z.infer<typeof RegistrationSchema>;
