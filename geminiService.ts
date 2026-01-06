
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { ApprenticeshipProfile, EmployerMatch, OutreachSegment, OutreachAssets, LinkedInPost } from "./types";

/**
 * Takes structured form data and enhances it with AI to provide target job titles 
 * and additional context needed for employer discovery.
 */
export const enhanceProfile = async (formData: Partial<ApprenticeshipProfile>): Promise<ApprenticeshipProfile> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Enhance this apprenticeship information for employer matching and strategic planning.
    
    Program Title: ${formData.title}
    Region: ${formData.region}
    Industries: ${formData.industries}
    URL: ${formData.ctaLink || 'None provided'}
    
    PROVIDED CONTACT DETAILS (Preserve these unless you find more accurate ones on the URL):
    - Name: ${formData.primaryContactInfo?.name || 'Not provided'}
    - Email: ${formData.primaryContactInfo?.email || 'Not provided'}
    - Phone: ${formData.primaryContactInfo?.phone || 'Not provided'}
    
    TASKS:
    1. Create a compelling 2-sentence Elevator Pitch.
    2. Provide geographic/economic analytics for the ${formData.region} area (labor market trends, key employers, growth rate).
    3. Determine a realistic pay/wage range based on current market data for this region and industry.
    4. If a URL is provided, search for and extract the Primary Contact (Name, Email, Phone). If not found, use the PROVIDED CONTACT DETAILS above.
    5. Summarize the program page content (if URL provided) into a concise one-page style summary.
    6. Assess if safety training/compliance (OSHA, etc.) is likely involved.
    7. Generate Target Job Titles, Hard Skills, and Soft Skills.
    8. Provide 3 Strategic Suggestions.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          region: { type: Type.STRING },
          industries: { type: Type.ARRAY, items: { type: Type.STRING } },
          elevatorPitch: { type: Type.STRING },
          geoAnalytics: { type: Type.STRING, description: 'Economic and labor market overview of the region' },
          wageRange: { type: Type.STRING },
          primaryContactInfo: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING }
            }
          },
          siteSummary: { type: Type.STRING, description: 'Brief summary of the provided URL content' },
          safetyAssessment: { type: Type.STRING, description: 'Evaluation of safety training requirements' },
          skills: {
            type: Type.OBJECT,
            properties: {
              hard: { type: Type.ARRAY, items: { type: Type.STRING } },
              soft: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['hard', 'soft']
          },
          credentials: { type: Type.ARRAY, items: { type: Type.STRING } },
          targetJobTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
          startDate: { type: Type.STRING },
          ctaLink: { type: Type.STRING },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['title', 'region', 'industries', 'elevatorPitch', 'geoAnalytics', 'wageRange', 'safetyAssessment', 'skills', 'targetJobTitles', 'startDate', 'suggestions']
      }
    }
  });

  return JSON.parse(response.text);
};

export const discoverEmployers = async (profile: ApprenticeshipProfile): Promise<EmployerMatch[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Based on this apprenticeship profile:
  - Title: ${profile.title}
  - Industries: ${profile.industries.join(", ")}
  - Region: ${profile.region}
  - Target Job Titles: ${profile.targetJobTitles.join(", ")}
  
  Propose EXACTLY 50 real or highly representative potential employer targets in this region. 
  For each, score them based on: 
  Industry alignment (30%), Job title overlap (25%), Skill overlap (25%), Geographic proximity (10%), Hiring signals (10%).
  Assign them an outreach segment from: ${Object.values(OutreachSegment).join(", ")}.
  Include basic contact info: website, phone, and a generic contact email if possible.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            score: { type: Type.NUMBER },
            rationale: { type: Type.STRING },
            segment: { type: Type.STRING },
            industryAlignment: { type: Type.NUMBER },
            jobTitleOverlap: { type: Type.NUMBER },
            skillOverlap: { type: Type.NUMBER },
            geographicProximity: { type: Type.NUMBER },
            hiringSignals: { type: Type.NUMBER },
            website: { type: Type.STRING },
            phone: { type: Type.STRING },
            contactEmail: { type: Type.STRING }
          },
          required: ['name', 'score', 'rationale', 'segment', 'industryAlignment', 'jobTitleOverlap', 'skillOverlap', 'geographicProximity', 'hiringSignals']
        }
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateOutreach = async (profile: ApprenticeshipProfile, employer: EmployerMatch): Promise<OutreachAssets> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a tailored outreach package for ${employer.name} for the ${profile.title} apprenticeship program. 
    Segment focus: ${employer.segment}. 
    Region: ${profile.region}. 
    CTA: ${profile.ctaLink || 'Visit our official website'}. 
    Include 1 primary email, 3 follow-ups, a phone call script, and a specific LinkedIn message (DM/InMail style). 
    Always include the mandatory disclaimer: "Participation does not guarantee hiring outcomes; program availability subject to enrollment and eligibility."`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          primaryEmail: { type: Type.STRING, description: '140-180 words primary email' },
          followUps: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3 follow-up emails, 80-120 words each' },
          callScript: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Bullet points for a call script' },
          subjectLines: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3 subject line options' },
          linkedInMessage: { type: Type.STRING, description: 'A tailored, personal LinkedIn outreach message' }
        },
        required: ['primaryEmail', 'followUps', 'callScript', 'subjectLines', 'linkedInMessage']
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateLinkedInCalendar = async (profile: ApprenticeshipProfile): Promise<LinkedInPost[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate exactly 10 FRESH and UNIQUE LinkedIn posts specifically written for AN EMPLOYER AUDIENCE to recruit them for the ${profile.title} apprenticeship program. 
    Current timestamp to ensure uniqueness: ${Date.now()}.
    Focus on ROI, filling skills gaps, and simplifying their hiring pipeline. 
    Avoid repetition from previous runs. Use a professional partnership-oriented tone. 
    
    IMPORTANT: You MUST include the following link naturally within the content of every post: ${profile.ctaLink || 'Visit our official website'}.
    
    Pillars to rotate across the 10 posts: 
    1. Employer ROI/Value (Cost savings, retention)
    2. Talent Pipeline (Developing local skills)
    3. Program Spotlight (Ease of participation, credentials)
    4. Industry Insight (Future-proofing the workforce)
    5. Community Impact (Local economic growth)
    6. Diversity & Inclusion (Broadening the talent pool)
    
    For each post, provide 3-5 relevant and trending hashtags.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.NUMBER },
            pillar: { type: Type.STRING },
            content: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3-5 relevant hashtags' }
          },
          required: ['day', 'pillar', 'content', 'hashtags']
        }
      }
    }
  });

  return JSON.parse(response.text);
};

export const generatePostGraphic = async (post: LinkedInPost, profile: ApprenticeshipProfile): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `A professional, clean, and high-impact LinkedIn post graphic representing the theme: "${post.pillar}". 
  Specific context: "${post.content.substring(0, 300)}".
  Recruiting employers for a "${profile.title}" apprenticeship program in the "${profile.industries.join(", ")}" industries. 
  Visual Style: Modern corporate photography or high-end professional digital illustration. 
  Themes: Collaboration, technical excellence, future workforce, and economic growth. 
  Crucial: Do not include any text in the image. High-quality lighting and professional business aesthetic. 1K resolution.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to extract image data");
};

export const generateSpeech = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read the following outreach content professionally and clearly: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Failed to generate audio output");
  }
  return base64Audio;
};
