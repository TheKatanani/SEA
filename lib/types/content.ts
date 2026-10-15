export type Program = {
  slug: string;
  href: string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  image: string;
  category: string;
  categoryEn?: string;
  status: string;
  statusEn?: string;
  duration?: string;
  durationEn?: string;
  hoursAndSchedule?: string;
  targetAudience?: string;
  pillars: string[];
  outcomes?: string;
  careers?: string;
  requirements?: string;
  documents: string[];
  source?: string;
  isDiploma: boolean;
};

export type FaqRecord = { id: string; question: string; answer: string };
export type GalleryRecord = { id: string; type: "photo" | "video"; url: string; thumbnailUrl?: string; title: string; alt: string; duration?: string };
