
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Briefcase, 
  Target, 
  Mail, 
  Linkedin, 
  BarChart2, 
  Plus, 
  ChevronRight, 
  ChevronLeft,
  Search,
  CheckCircle,
  AlertCircle,
  FileText,
  Copy,
  Download,
  X,
  Phone,
  MessageSquare,
  Globe,
  Mail as MailIcon,
  RefreshCw,
  Image as ImageIcon,
  Loader2,
  Volume2,
  Square,
  Share2,
  CopyCheck,
  HelpCircle,
  Edit2,
  Zap,
  ShieldCheck,
  Rocket,
  Users,
  Layout,
  ChevronDown,
  BookOpen,
  Info,
  ExternalLink,
  ShieldAlert,
  Terminal,
  Scale,
  Award,
  Gavel,
  Check,
  ArrowLeft,
  Lightbulb,
  BadgeCheck,
  TrendingUp,
  MapPin,
  Send,
  User,
  Bot,
  Sparkles,
  RotateCcw,
  Trash2,
  GraduationCap,
  CheckSquare,
  Square as CheckboxIcon,
  ArrowRight,
  Menu,
  DollarSign,
  Contact,
  HardHat,
  Monitor,
  Eye,
  Calendar,
  Layers,
  Hash,
  TrendingUp as TrendingIcon,
  Sparkle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { ApprenticeshipProfile, EmployerMatch, OutreachAssets, LinkedInPost, Step } from './types';
import { enhanceProfile, discoverEmployers, generateOutreach, generateLinkedInCalendar, generatePostGraphic, generateSpeech } from './geminiService';

// Message type for local chat
interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// Audio decoding utilities
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Accessible FormField with Tooltip support
const FormField = ({ label, example, value, onChange, placeholder, error, tooltip }: any) => (
  <div className="space-y-1.5 group relative">
    <div className="flex items-center gap-1.5">
      <label className={`text-sm font-bold block transition-colors ${error ? 'text-red-600' : 'text-slate-900'}`}>
        {label}
      </label>
      {tooltip && (
        <div className="relative group/tooltip flex items-center">
          <button 
            type="button"
            className="text-slate-400 hover:text-blue-500 transition-colors focus:outline-none focus:text-blue-600"
            aria-label={`Information about ${label}`}
          >
            <HelpCircle size={14} />
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-800 text-white text-[10px] leading-relaxed rounded-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:visible pointer-events-none transition-all duration-200 z-50 shadow-2xl border border-slate-700">
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800" />
          </div>
        </div>
      )}
    </div>
    <input
      type="text"
      className={`w-full p-3 bg-white border rounded-xl outline-none transition-all text-sm placeholder:text-slate-500 
        ${error 
          ? 'border-red-500 ring-2 ring-red-100 bg-red-50/30 text-red-900 focus:ring-red-200 focus:border-red-600' 
          : 'border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
        }`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={!!error}
      aria-describedby={error ? `${label}-error` : undefined}
    />
    <div className="flex justify-between items-start gap-2">
      <p id={error ? `${label}-error` : undefined} className={`text-[11px] font-medium ${error ? 'text-red-500' : 'text-slate-600'}`}>
        {error ? error : `Example: ${example}`}
      </p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [step, setStep] = useState<Step>('landing');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  const [profile, setProfile] = useState<ApprenticeshipProfile | null>(null);
  const [matches, setMatches] = useState<EmployerMatch[]>([]);
  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(new Set());
  const [outreachData, setOutreachData] = useState<Record<string, OutreachAssets>>({});
  const [linkedinPosts, setLinkedinPosts] = useState<LinkedInPost[]>([]);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const [showComplianceSticky, setShowComplianceSticky] = useState(true);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Home Screen Quick Chat
  const [homeChatInput, setHomeChatInput] = useState('');

  // Speech State
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [isLoadingSpeech, setIsLoadingSpeech] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Form State
  const initialForm = {
    title: '',
    region: '',
    industries: '',
    wageRange: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    programLink: '',
    termsAccepted: false
  };

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeModal, setActiveModal] = useState<{ type: 'followups' | 'script' | 'linkedin'; employer: string } | null>(null);

  const isActuallyExpanded = !isSidebarCollapsed || isSidebarHovered;

  const progress = useMemo(() => {
    if (step === 'landing') return 0;
    
    // If in chat mode, progress is based on filled form fields (title, region, industries)
    if (step === 'chat') {
      const requiredFields = ['title', 'region', 'industries'];
      const filledCount = requiredFields.filter(f => !!(form as any)[f]).length;
      return (filledCount / requiredFields.length) * 100;
    }

    const linearSteps: Step[] = ['intake', 'discovery', 'report', 'outreach', 'linkedin'];
    const index = linearSteps.indexOf(step);
    if (index === -1) return 100;
    
    if (step === 'linkedin') {
      return linkedinPosts.length > 0 ? 100 : 95;
    }
    
    return ((index + 1) / linearSteps.length) * 100;
  }, [step, linkedinPosts.length, form]);

  // Derive suggested hashtags based on profile industries
  const suggestedHashtagsBank = useMemo(() => {
    if (!profile) return ['Apprenticeship', 'WorkforceDevelopment', 'LocalHiring', 'FutureOfWork'];
    const base = ['Apprenticeship', 'WorkforceDevelopment', 'LocalHiring', 'FutureOfWork', 'SkillsGap', 'CommunityImpact', 'TalentPipeline'];
    const industryTags = profile.industries.map(i => i.replace(/\s+/g, ''));
    return [...new Set([...base, ...industryTags])];
  }, [profile]);

  // Handle auto-scrolling chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Reset main scroll position when switching steps
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [step]);

  // Handle auto-scrolling when docs step is active
  useEffect(() => {
    if ((step === 'docs' || step === 'terms') && pendingScrollId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(pendingScrollId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setPendingScrollId(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [step, pendingScrollId]);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const stopSpeech = () => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch(e) {}
      currentSourceRef.current = null;
    }
    setSpeakingText(null);
    setIsLoadingSpeech(false);
  };

  const handleResetEngine = () => {
    const confirmed = window.confirm("This will clear all current progress, employer matches, and generated campaigns. Are you sure you want to start a new engine run?");
    if (confirmed) {
      setForm(initialForm);
      setErrors({});
      setProfile(null);
      setMatches([]);
      setSelectedEmployers(new Set());
      setOutreachData({});
      setLinkedinPosts([]);
      setChatMessages([]);
      stopSpeech();
      setStep('intake');
    }
  };

  const navigateToDocSection = (sectionId: string) => {
    setPendingScrollId(sectionId);
    setStep('docs');
  };

  const handleReadAloud = async (text: string) => {
    if (speakingText === text) {
      stopSpeech();
      return;
    }
    
    stopSpeech();
    setIsLoadingSpeech(true);
    setSpeakingText(text);

    try {
      const base64Audio = await generateSpeech(text);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (currentSourceRef.current === source) {
          setSpeakingText(null);
          currentSourceRef.current = null;
        }
      };
      source.start(0);
      currentSourceRef.current = source;
      setIsLoadingSpeech(false);
    } catch (error) {
      console.error("Speech error:", error);
      alert("Failed to read aloud. Please check your connection.");
      stopSpeech();
    }
  };

  const handleDownloadImage = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `AEGE_${fileName.replace(/\s+/g, '_').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareImage = async (dataUrl: string, title: string) => {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'apprenticeship-graphic.png', { type: 'image/png' });

      // Check for Web Share API
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Apprenticeship Opportunity: ${title}`,
          text: 'Building a stronger workforce together. Check out our new apprenticeship partnership opportunities!',
        });
      } else {
        // Fallback: Try to copy to clipboard for manual paste sharing
        try {
          const data = [new ClipboardItem({ 'image/png': blob })];
          await navigator.clipboard.write(data);
          alert("Sharing not natively supported in this browser, but we've COPIED the image to your clipboard! You can now paste it directly into your LinkedIn feed.");
        } catch (copyErr) {
          alert("Sharing not supported. Please use the Download button to save the graphic for your post.");
        }
      }
    } catch (err) {
      console.error('Share error:', err);
      alert("Could not share graphic. Please try downloading it instead.");
    }
  };

  const handleCopyAllLinkedInPosts = () => {
    if (linkedinPosts.length === 0) return;
    const allText = linkedinPosts.map((p, i) => `[POST ${i+1} - ${p.pillar}]\n${p.content}\n${p.hashtags.map(h => `#${h}`).join(' ')}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(allText);
    alert("All generated LinkedIn posts copied to clipboard!");
  };

  const handleCopyAllOutreach = () => {
    let combinedText = `--- AEGE OUTREACH CAMPAIGN SUMMARY ---\n`;
    combinedText += `Apprenticeship: ${profile?.title || 'Unknown'}\n`;
    combinedText += `Date: ${new Date().toLocaleDateString()}\n\n`;

    const generatedMatches = matches.filter(m => selectedEmployers.has(m.name) && outreachData[m.name]);
    
    if (generatedMatches.length === 0) {
      alert("No outreach assets have been built for selected employers yet.");
      return;
    }

    generatedMatches.forEach((match, index) => {
      const data = outreachData[match.name];
      combinedText += `[${index + 1}] TARGET EMPLOYER: ${match.name}\n`;
      combinedText += `Segment: ${match.segment}\n\n`;
      combinedText += `PRIMARY EMAIL:\n${data.primaryEmail}\n\n`;
      combinedText += `LINKEDIN DM:\n${data.linkedInMessage}\n\n`;
      combinedText += `CALL SCRIPT POINTS:\n`;
      data.callScript.forEach((point, i) => {
        combinedText += `- ${point}\n`;
      });
      combinedText += `\n--------------------------------------------\n\n`;
    });

    navigator.clipboard.writeText(combinedText);
    alert(`Aggregated outreach for ${generatedMatches.length} employers copied to clipboard!`);
  };

  const handleUpdatePost = (index: number, updates: Partial<LinkedInPost>) => {
    setLinkedinPosts(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const toggleSelection = (name: string) => {
    setSelectedEmployers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAllSelections = () => {
    if (selectedEmployers.size === matches.length) {
      setSelectedEmployers(new Set());
    } else {
      setSelectedEmployers(new Set(matches.map(m => m.name)));
    }
  };

  const filteredMatches = useMemo(() => {
    return matches.filter(m => selectedEmployers.has(m.name));
  }, [matches, selectedEmployers]);

  // UI Component for Speech/Copy Buttons
  const ActionButtons = ({ text, label }: { text: string, label: string }) => (
    <div className="flex items-center gap-1.5">
      <button 
        onClick={() => handleReadAloud(text)}
        className={`p-1.5 rounded-lg transition-all focus:ring-2 focus:ring-blue-500 outline-none ${
          speakingText === text 
          ? 'bg-red-100 text-red-600 hover:bg-red-200' 
          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
        }`}
        aria-label={speakingText === text ? `Stop reading ${label}` : `Read aloud ${label}`}
        title={speakingText === text ? "Stop Reading" : "Read Aloud"}
      >
        {isLoadingSpeech && speakingText === text ? (
          <Loader2 size={16} className="animate-spin" />
        ) : speakingText === text ? (
          <Square size={16} fill="currentColor" />
        ) : (
          <Volume2 size={16} />
        )}
      </button>
      <button 
        onClick={() => copyToClipboard(text)} 
        className="p-1.5 bg-slate-100 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all focus:ring-2 focus:ring-blue-500 outline-none"
        aria-label={`Copy ${label} to clipboard`}
        title="Copy to Clipboard"
      >
        <Copy size={16} />
      </button>
    </div>
  );

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.title.trim()) newErrors.title = 'Title or description is required';
    if (!form.region.trim()) newErrors.region = 'Region / Service Area is required';
    if (!form.industries.trim()) newErrors.industries = 'Please list at least one industry';
    if (!form.termsAccepted) newErrors.termsAccepted = 'You must accept the terms and conditions to proceed';
    
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    if (form.programLink.trim() && !urlPattern.test(form.programLink)) {
      newErrors.programLink = 'Please enter a valid URL (e.g., https://college.edu)';
    }

    if (form.contactEmail.trim() && !/^\S+@\S+\.\S+$/.test(form.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProcessIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      const firstError = document.querySelector('[aria-invalid="true"]');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setLoading(true);
    try {
      const industriesArray = form.industries.split(',').map(i => i.trim()).filter(Boolean);
      const result = await enhanceProfile({
        ...form,
        industries: industriesArray,
        startDate: 'TBD',
        ctaLink: form.programLink,
        primaryContactInfo: {
          name: form.contactName,
          email: form.contactEmail,
          phone: form.contactPhone
        }
      });
      setProfile(result);
      setStep('discovery');
    } catch (error) {
      console.error(error);
      alert("Failed to process profile. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunDiscovery = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const result = await discoverEmployers(profile);
      setMatches(result);
      setSelectedEmployers(new Set(result.map(m => m.name)));
      setStep('report');
    } catch (error) {
      console.error(error);
      alert("Discovery failed. Check API connectivity.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOutreach = async (employer: EmployerMatch) => {
    if (!profile) return;
    setLoading(true);
    try {
      const result = await generateOutreach(profile, employer);
      setOutreachData(prev => ({ ...prev, [employer.name]: result }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLinkedin = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // The service is now updated to return 10 posts
      const result = await generateLinkedInCalendar(profile);
      setLinkedinPosts(result);
      setStep('linkedin');
      
      // Celebration Confetti
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563eb', '#1e40af', '#ffffff', '#60a5fa']
      });
    } catch (error) {
      console.error(error);
      alert("LinkedIn engine failure. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGraphic = async (postIndex: number) => {
    if (!profile || !linkedinPosts[postIndex]) return;
    setGeneratingImages(prev => ({ ...prev, [postIndex]: true }));
    try {
      const imageUrl = await generatePostGraphic(linkedinPosts[postIndex], profile);
      const updatedPosts = [...linkedinPosts];
      updatedPosts[postIndex] = { ...updatedPosts[postIndex], imageUrl };
      setLinkedinPosts(updatedPosts);
    } catch (error) {
      console.error(error);
      alert("Failed to generate graphic. Please try again.");
    } finally {
      setGeneratingImages(prev => ({ ...prev, [postIndex]: false }));
    }
  };

  // CHAT BOT LOGIC
  const handleSendChat = async (overridePrompt?: string, stateOverrides?: Partial<typeof form>) => {
    const textToSend = overridePrompt || chatInput;
    if (!textToSend.trim() || isChatLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: textToSend };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const intakeTool: FunctionDeclaration = {
        name: 'collect_intake_data',
        parameters: {
          type: Type.OBJECT,
          description: 'Extract and save apprenticeship intake information from the conversation.',
          properties: {
            title: { type: Type.STRING, description: 'The title of the apprenticeship' },
            region: { type: Type.STRING, description: 'Geographic identifier. Cities like "Fresno" are regions.' },
            industries: { type: Type.STRING, description: 'Comma-separated list of target industries' },
            wageRange: { type: Type.STRING, description: 'The typical wage or salary range' },
            contactName: { type: Type.STRING, description: 'The primary contact name' },
            contactEmail: { type: Type.STRING, description: 'The primary contact email' },
            contactPhone: { type: Type.STRING, description: 'The primary contact phone' },
            programLink: { type: Type.STRING, description: 'The official program page URL' }
          }
        }
      };

      const currentSnapForm = { ...form, ...(stateOverrides || {}) };

      const systemInstruction = `You are the AEGE Conversational Intake Agent. Your SOLE PURPOSE is to gather specific data to build an apprenticeship profile.
      
      INTAKE PROTOCOL:
      1. Title: Informal program name.
      2. Region: City or County.
      3. Industries: Target sectors.
      4. Contact: Name, Email, Phone.
      5. Program Link: Official website (Optional).

      CURRENT PROGRESS: ${JSON.stringify(currentSnapForm)}

      STRICT COMMANDS:
      - If the user provides info, use 'collect_intake_data' and ask for the NEXT missing field.
      - NEVER ask for the same thing twice.
      - Be punchy and informal. Max 1-2 short sentences.`;

      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: { 
          systemInstruction,
          tools: [{ functionDeclarations: [intakeTool] }]
        },
        history: chatMessages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }))
      });

      const response = await chat.sendMessage({ message: textToSend });
      
      let localFormState = { ...currentSnapForm };
      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          if (fc.name === 'collect_intake_data') {
            const args = fc.args as any;
            localFormState = {
              ...localFormState,
              ...Object.fromEntries(Object.entries(args).filter(([_, v]) => v != null))
            };
            setForm(localFormState);
          }
        }
      }

      let finalResponseText = response.text;
      const isMissingTitle = !localFormState.title;
      const isMissingRegion = !localFormState.region;
      const isMissingIndustries = !localFormState.industries;
      const isMissingContact = !localFormState.contactName || !localFormState.contactEmail;

      if (!finalResponseText || finalResponseText.trim() === "") {
        if (isMissingTitle) finalResponseText = "What's the name of the program?";
        else if (isMissingRegion) finalResponseText = "Which region or city will this serve?";
        else if (isMissingIndustries) finalResponseText = "Which industries are we targeting?";
        else if (isMissingContact) finalResponseText = "Who is the primary contact? (Name and Email please)";
        else finalResponseText = "I have the core details! Ready to open the form and finalize?";
      }

      const modelMsg: ChatMessage = { role: 'model', text: finalResponseText };
      setChatMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: "Connection issue. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleLaunchChat = () => {
    if (!homeChatInput.trim()) return;
    const initialText = homeChatInput;
    setHomeChatInput('');
    setStep('chat');
    // Pre-fill form state locally
    setForm(prev => ({ ...prev, title: initialText }));
    handleSendChat(initialText, { title: initialText });
  };

  const downloadMatchReport = () => {
    if (matches.length === 0) return;
    const headers = ["Employer", "Score", "Segment", "Website", "Phone", "Email", "Rationale"];
    const rows = matches.map(m => [
      `"${m.name}"`,
      m.score,
      `"${m.segment}"`,
      `"${m.website || ''}"`,
      `"${m.phone || ''}"`,
      `"${m.contactEmail || ''}"`,
      `"${m.rationale}"`
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `employer_match_report_${profile?.title.replace(/\s+/g, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const updateField = (field: string, value: any) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const hasSubstantialData = useMemo(() => {
    return form.title && form.region && form.industries;
  }, [form]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      {step !== 'landing' && step !== 'terms' && step !== 'docs' && (
        <aside 
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          className={`hidden lg:flex ${isActuallyExpanded ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col shrink-0 transition-all duration-300 ease-in-out animate-in slide-in-from-left duration-500 relative border-r border-slate-800 group/sidebar`}
        >
          {/* Vertical Center Toggle Handle */}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute top-1/2 -right-3 -translate-y-1/2 z-[70] w-6 h-12 bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center rounded-full border-2 border-slate-900 shadow-lg transition-transform hover:scale-110 active:scale-95"
            title={isActuallyExpanded ? "Pin / Collapse Sidebar" : "Pin / Expand Sidebar"}
          >
            {isActuallyExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>

          <div className={`p-6 border-b border-slate-800 flex ${!isActuallyExpanded ? 'flex-col items-center gap-4' : 'items-center justify-between'}`}>
            <div className={`flex items-center gap-2 transition-all duration-300 ${!isActuallyExpanded ? 'opacity-0 w-0 h-0 pointer-events-none' : 'opacity-100 w-auto'}`}>
              <Target className="text-blue-400 shrink-0" size={24} />
              <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">AEGE Engine</h1>
            </div>
            {!isActuallyExpanded && <Target className="text-blue-400" size={32} />}
          </div>
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
            {[
              { id: 'landing', icon: Layout, label: 'Overview' },
              { id: 'intake', icon: FileText, label: 'Job Intake' },
              { id: 'discovery', icon: Search, label: 'Employer Discovery', requiresProfile: true },
              { id: 'report', icon: BarChart2, label: 'Match Report', requiresProfile: true },
              { id: 'outreach', icon: Mail, label: 'Campaign Builder', requiresProfile: true },
              { id: 'linkedin', icon: Linkedin, label: 'LinkedIn Engine', requiresProfile: true },
              { id: 'chat', icon: MessageSquare, label: 'AEGE Assistant', highlight: true },
              { id: 'docs', icon: BookOpen, label: 'White Papers' },
            ].filter(item => !item.requiresProfile || profile).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setStep(item.id as Step);
                  stopSpeech();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all outline-none focus:ring-2 focus:ring-blue-500 group ${
                  step === item.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                } ${item.highlight && step !== item.id ? 'border-l-2 border-blue-500' : ''} ${!isActuallyExpanded ? 'justify-center' : ''}`}
                title={!isActuallyExpanded ? item.label : undefined}
              >
                <item.icon size={20} className="shrink-0" />
                <span className={`font-medium whitespace-nowrap transition-all duration-300 origin-left ${!isActuallyExpanded ? 'opacity-0 w-0 scale-0 pointer-events-none' : 'opacity-100 w-auto scale-100'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>
          
          <div className={`p-4 border-t border-slate-800 transition-all duration-300 ${!isActuallyExpanded ? 'opacity-0 h-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="bg-slate-800 rounded-xl p-4 space-y-3">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Session</p>
               <div className="space-y-2">
                 <button 
                  onClick={handleResetEngine}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors group"
                 >
                   <RotateCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                   New Project Run
                 </button>
               </div>
               <div className="pt-2">
                 <p className="text-[10px] font-semibold text-slate-400">Powered by Gemini 3.0</p>
                 <p className="text-[10px] font-semibold text-blue-400">Employer Growth Engine</p>
               </div>
            </div>
          </div>
        </aside>
      )}

      <main ref={mainRef} className={`flex-1 relative flex flex-col bg-slate-50 h-screen ${step === 'chat' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {step !== 'landing' && step !== 'terms' && step !== 'docs' && (
          <div className="sticky top-0 z-[60] w-full bg-white/80 backdrop-blur-sm border-b border-slate-200 shrink-0">
            <div className="w-full h-[3px] bg-slate-100 overflow-hidden">
              <div 
                className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all duration-700 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="px-4 md:px-8 py-1.5 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {step === 'chat' ? 'Assisted Intake Progress' : 'Workflow Progress'}
              </span>
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">
                {Math.round(progress)}% Complete
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
            <p className="text-slate-900 font-bold">Processing Engine Steps...</p>
          </div>
        )}

        {step === 'landing' && (
          <div className="min-h-full flex flex-col">
            <header className="sticky top-0 z-[70] w-full px-8 py-4 flex justify-between items-center transition-all bg-slate-900/60 backdrop-blur-xl border-b border-white/5">
              <div className="flex items-center gap-2">
                <Target className="text-blue-400" size={32} />
                <span className="text-2xl font-black tracking-tighter text-white">AEGE<span className="text-blue-500">.</span></span>
              </div>
              <div className="hidden md:flex items-center gap-8 text-slate-400 font-bold text-sm">
                <button onClick={() => navigateToDocSection('docs-process')} className="hover:text-white transition-colors">Documentation</button>
                <button onClick={() => navigateToDocSection('docs-impact')} className="hover:text-white transition-colors">ROI Impact</button>
                <button onClick={() => navigateToDocSection('docs-compliance')} className="hover:text-white transition-colors">Compliance</button>
              </div>
              <button 
                onClick={() => setStep('intake')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
              >
                Launch Engine
              </button>
            </header>

            <section className="bg-slate-900 text-white pt-24 pb-48 px-8 relative overflow-hidden flex flex-col items-center justify-center min-h-[85vh]">
              <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/10 blur-[120px] rounded-full -mr-24 -mt-24 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-indigo-600/10 blur-[100px] rounded-full -ml-24 -mb-24 pointer-events-none"></div>
              
              <div className="max-w-6xl mx-auto relative z-10 text-center space-y-12">
                <div className="inline-flex items-center gap-2 bg-blue-600/15 text-blue-400 px-5 py-2.5 rounded-full text-xs font-black border border-blue-600/20 uppercase tracking-widest animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <Zap size={14} className="fill-current" />
                  <span>The Workforce Intelligence Engine</span>
                </div>
                
                <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 flex flex-col gap-2">
                  <span className="block">Scale Your</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-sky-400 pb-2">Employer Network.</span>
                </h1>
                
                <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
                  AEGE automates discovery, tailored outreach, and multi-channel marketing to build sustainable employer pipelines at elite scale.
                </p>
                
                <div className="max-w-2xl mx-auto w-full pt-8 animate-in fade-in slide-in-from-bottom-16 duration-700 delay-300">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative flex items-center bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-2 pr-4 shadow-2xl">
                      <div className="pl-4 text-blue-400">
                        <Sparkles size={24} />
                      </div>
                      <input 
                        type="text"
                        value={homeChatInput}
                        onChange={(e) => setHomeChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLaunchChat()}
                        placeholder="What's the name of your apprenticeship program?"
                        className="flex-1 bg-transparent border-none text-white px-4 py-4 outline-none placeholder:text-slate-500 font-bold text-lg"
                      />
                      <button 
                        onClick={handleLaunchChat}
                        className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/20"
                      >
                        <Send size={24} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-center gap-6 mt-6">
                    <button 
                      onClick={() => setStep('intake')}
                      className="text-slate-400 hover:text-white font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-colors"
                    >
                      Or Manual Entry <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="pt-12 animate-bounce opacity-50">
                  <ChevronDown className="mx-auto text-slate-400" size={40} />
                </div>
              </div>
            </section>
            
            <section id="process" className="py-32 px-8 bg-white relative">
              <div className="max-w-6xl mx-auto">
                <div className="text-center mb-20 space-y-4">
                  <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">The 5-Step Partnership Lifecycle</h2>
                  <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">Automating the most critical segments of the employer engagement funnel.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
                  <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 border-t-2 border-dashed border-slate-200 -z-0"></div>

                  {[
                    { icon: FileText, title: 'Intake', desc: 'Define your program skills and ROI.', color: 'blue' },
                    { icon: Search, title: 'Discovery', desc: 'AI scans local markets for employer matches.', color: 'indigo' },
                    { icon: BarChart2, title: 'Analysis', desc: 'Rank matches by alignment and hiring signals.', color: 'violet' },
                    { icon: Mail, title: 'Outreach', desc: 'Generate multi-touch campaign assets.', color: 'blue' },
                    { icon: Linkedin, title: 'Visibility', desc: 'Scale LinkedIn content for local impact.', color: 'sky' },
                  ].map((s, i) => (
                    <div key={i} className="relative z-10 flex flex-col items-center text-center p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all group">
                      <div className={`w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-6 shadow-xl shadow-blue-200 group-hover:rotate-12 transition-transform`}>
                        <s.icon size={32} />
                      </div>
                      <div className="absolute top-6 right-8 text-slate-200 font-black text-5xl opacity-30 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {i+1}
                      </div>
                      <h3 className="font-black text-xl text-slate-900 mb-2">{s.title}</h3>
                      <p className="text-sm text-slate-500 font-bold leading-relaxed">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <footer className="mt-auto py-16 px-8 border-t border-slate-100 bg-slate-50">
              <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
                <div className="flex items-center gap-3">
                   <Target className="text-blue-600" size={32} />
                   <span className="text-2xl font-black text-slate-900 tracking-tighter">AEGE<span className="text-blue-500">.</span></span>
                </div>
                <div className="flex flex-wrap justify-center gap-10 text-sm font-black text-slate-500 uppercase tracking-widest">
                  <button onClick={() => navigateToDocSection('docs-process')} className="hover:text-blue-600 transition-colors">Documentation</button>
                  <button onClick={() => setStep('terms')} className="hover:text-blue-600 transition-colors">Terms & Conditions</button>
                </div>
                <p className="text-xs font-bold text-slate-400">© 2025 AEGE Engine. Specialized Workforce Intelligence.</p>
              </div>
            </footer>
          </div>
        )}

        <div className={`px-4 md:px-8 pt-4 md:pt-8 w-full max-w-6xl mx-auto ${['landing', 'docs', 'terms'].includes(step) ? 'hidden' : 'flex-1 flex flex-col min-h-0'} ${step !== 'chat' ? 'pb-48' : 'pb-2 overflow-hidden'}`}>
          {step === 'intake' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col sm:flex-row justify-between items-start mb-8 border-b border-slate-100 pb-6 gap-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">Step 1: Apprenticeship Program</h2>
                    <p className="text-sm md:text-base text-slate-600 font-medium">Enter details below to generate an employer-facing profile.</p>
                  </div>
                  <button onClick={handleResetEngine} className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-100 hover:bg-red-50 rounded-xl transition-all font-bold text-[10px] md:text-xs">
                    <Trash2 size={16} /> Reset Form
                  </button>
                </div>
                <form onSubmit={handleProcessIntake} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 md:gap-y-8">
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField 
                      label="Apprenticeship Title/Description" 
                      example="Advanced Manufacturing Technician" 
                      value={form.title} 
                      onChange={(v: string) => updateField('title', v)} 
                      error={errors.title} 
                      tooltip="Enter the official or working name of your program. This helps AEGE identify relevant market trends."
                    />
                    <FormField 
                      label="Region / Service Area" 
                      example="Greater Atlanta Area" 
                      value={form.region} 
                      onChange={(v: string) => updateField('region', v)} 
                      error={errors.region} 
                      tooltip="Specify the city, county, or regional area this program serves. AEGE uses this to find local employer data."
                    />
                    <FormField 
                      label="Primary Industries" 
                      example="Aerospace, Automotive" 
                      value={form.industries} 
                      onChange={(v: string) => updateField('industries', v)} 
                      error={errors.industries} 
                      tooltip="List the key industry sectors (e.g., Healthcare, IT, Manufacturing). Separate multiple industries with commas."
                    />
                    <FormField 
                      label="Program Page Link (Optional)" 
                      example="https://college.edu/apprenticeship" 
                      value={form.programLink} 
                      onChange={(v: string) => updateField('programLink', v)} 
                      error={errors.programLink} 
                      tooltip="Provide a link to your current program website. AEGE will scan it to extract additional details automatically."
                    />
                  </div>

                  <div className="md:col-span-2 border-t border-slate-100 pt-8 mt-4">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <Contact className="text-blue-600" size={20} />
                      Primary Contact Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField 
                        label="Contact Name" 
                        example="Dr. Sarah Johnson" 
                        value={form.contactName} 
                        onChange={(v: string) => updateField('contactName', v)} 
                        tooltip="The primary person employers or AEGE should reach out to regarding this program."
                      />
                      <FormField 
                        label="Contact Email" 
                        example="s.johnson@college.edu" 
                        value={form.contactEmail} 
                        onChange={(v: string) => updateField('contactEmail', v)} 
                        error={errors.contactEmail} 
                        tooltip="The professional email address for partnership inquiries."
                      />
                      <FormField 
                        label="Contact Phone" 
                        example="(555) 123-4567" 
                        value={form.contactPhone} 
                        onChange={(v: string) => updateField('contactPhone', v)} 
                        tooltip="A direct line for rapid employer follow-up."
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-6 pt-6">
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <input id="termsAccepted" type="checkbox" checked={form.termsAccepted} onChange={(e) => updateField('termsAccepted', e.target.checked)} className="h-5 w-5 text-blue-600 border-slate-300 rounded" />
                      <div className="text-sm leading-6">
                        <label htmlFor="termsAccepted" className="font-bold text-slate-900">Accept <button type="button" onClick={() => setStep('terms')} className="text-blue-600 underline">Terms and Conditions</button></label>
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg outline-none">Submit Profile for Enhancement</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {step === 'discovery' && profile && (
            <div className="max-w-5xl mx-auto w-full space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 flex-1 overflow-y-auto pb-12 pr-1">
              <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                    <BadgeCheck size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Step 2: Verify Program Profile</h2>
                    <p className="text-sm text-slate-500 font-bold">Review the AI-enhanced program strategic report.</p>
                  </div>
                </div>
                <div className="flex gap-3 w-full lg:w-auto">
                  <button 
                    onClick={() => setStep('intake')}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3.5 rounded-2xl font-black transition-all outline-none"
                  >
                    <Edit2 size={18} />
                    Revise Profile
                  </button>
                  <button 
                    onClick={handleRunDiscovery} 
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-black shadow-xl shadow-blue-200 transition-all hover:scale-105 active:scale-95 outline-none"
                  >
                    <Search size={18} />
                    Scan Local Markets
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Summary & Analytics */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Elevator Pitch */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Zap size={80} />
                    </div>
                    <h3 className="flex items-center gap-2 text-xs font-black text-blue-600 uppercase tracking-widest mb-4">
                      <Sparkles size={14} /> The Elevator Pitch
                    </h3>
                    <p className="text-xl md:text-2xl font-bold text-slate-900 leading-tight italic">
                      "{profile.elevatorPitch}"
                    </p>
                  </div>

                  {/* Geographic Analytics */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                    <h3 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
                      <TrendingUp size={16} /> Regional Labor Market Analytics
                    </h3>
                    <div className="prose prose-slate max-w-none">
                      <div className="flex items-start gap-4 p-5 bg-blue-50 rounded-3xl border border-blue-100">
                        <MapPin className="text-blue-600 shrink-0 mt-1" size={24} />
                        <div>
                          <p className="font-bold text-slate-900 text-lg mb-1">{profile.region} Economic Overview</p>
                          <p className="text-slate-600 font-medium leading-relaxed">
                            {profile.geoAnalytics}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Site Summary (If URL provided) */}
                  {profile.siteSummary && (
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                      <h3 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
                        <Globe size={16} /> Program Page Intelligence
                      </h3>
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex gap-4">
                        <Monitor className="text-slate-400 shrink-0" size={24} />
                        <p className="text-sm text-slate-600 font-medium leading-relaxed italic">
                          {profile.siteSummary}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Target Job Titles & Industries */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Common Industries</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.industries.map((ind, i) => (
                          <span key={i} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold border border-indigo-100">
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Target Job Titles</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.targetJobTitles.map((title, i) => (
                          <span key={i} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold border border-blue-100">
                            {title}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Skills & Details */}
                <div className="space-y-6">
                  {/* Wage Range */}
                  <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10">
                      <DollarSign size={100} />
                    </div>
                    <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Estimated Local Wage Range</h3>
                    <p className="text-3xl font-black tracking-tight">{profile.wageRange}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">Based on local hiring data</p>
                  </div>

                  {/* Primary Contact */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Primary Contact</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Name</p>
                          <p className="font-bold text-slate-900">{profile.primaryContactInfo?.name || 'Not identified'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                          <MailIcon size={20} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Email</p>
                          <p className="font-bold text-slate-900 truncate max-w-[150px]">{profile.primaryContactInfo?.email || 'Not identified'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                          <Phone size={20} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Phone</p>
                          <p className="font-bold text-slate-900">{profile.primaryContactInfo?.phone || 'Not identified'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Safety Assessment */}
                  <div className="bg-amber-50 rounded-[2.5rem] p-8 border border-amber-200">
                    <h3 className="flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-widest mb-4">
                      <HardHat size={16} /> Safety & Compliance
                    </h3>
                    <p className="text-sm font-bold text-amber-900 leading-relaxed">
                      {profile.safetyAssessment}
                    </p>
                  </div>

                  {/* Hard Skills */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Core Hard Skills</h3>
                    <ul className="space-y-3">
                      {profile.skills.hard.map((skill, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-700">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                          {skill}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Soft Skills */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Essential Soft Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.soft.map((skill, i) => (
                        <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-black uppercase tracking-wider">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'report' && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700">
              <header className="flex justify-between items-end">
                 <h2 className="text-2xl font-bold">Employer Match Report</h2>
                 <button onClick={() => setStep('outreach')} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black shadow-md">Build Campaigns</button>
              </header>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-bold text-xs uppercase tracking-widest">Employer</th>
                      <th className="px-6 py-4 font-bold text-xs uppercase tracking-widest min-w-[200px]">Match Score</th>
                      <th className="px-6 py-4 font-bold text-xs text-right uppercase tracking-widest">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {matches.map((m) => (
                      <tr key={m.name} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 font-bold text-slate-900">{m.name}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                  m.score >= 90 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                  m.score >= 75 ? 'bg-green-500' :
                                  m.score >= 60 ? 'bg-amber-500' :
                                  m.score >= 40 ? 'bg-orange-500' :
                                  'bg-rose-500'
                                }`}
                                style={{ width: `${m.score}%` }}
                              />
                            </div>
                            <span className={`text-xs font-black w-10 text-right ${
                              m.score >= 90 ? 'text-emerald-700' :
                              m.score >= 75 ? 'text-green-700' :
                              m.score >= 60 ? 'text-amber-700' :
                              m.score >= 40 ? 'text-orange-700' :
                              'text-rose-700'
                            }`}>{m.score}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => { handleGenerateOutreach(m); setStep('outreach'); }} className="text-blue-600 font-black underline group-hover:text-blue-800 transition-colors">Build Campaign</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'outreach' && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700">
              <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900">Campaign Outreach Builder</h2>
                  <p className="text-sm md:text-base text-slate-600 font-medium">Customized messaging for {filteredMatches.length} selected employers.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                   <button 
                    onClick={() => setStep('report')}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm text-xs md:text-sm outline-none"
                  >
                    Adjust Selection
                  </button>
                  {filteredMatches.length > 0 && (
                    <button 
                      onClick={handleCopyAllOutreach}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all text-xs md:text-sm outline-none"
                    >
                      <CopyCheck size={18} />
                      Copy All
                    </button>
                  )}
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredMatches.map(match => (
                  <div key={match.name} className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-300 hover:border-blue-400 transition-colors flex flex-col gap-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base md:text-lg text-slate-900 truncate" title={match.name}>{match.name}</h3>
                        <p className="text-[10px] md:text-xs text-blue-700 font-black truncate uppercase tracking-wide">{match.segment}</p>
                      </div>
                      <button 
                        onClick={() => handleGenerateOutreach(match)}
                        className="shrink-0 text-[9px] md:text-[10px] uppercase font-black bg-slate-900 text-white px-2.5 py-1.5 rounded-lg hover:bg-black transition-colors outline-none"
                      >
                        {outreachData[match.name] ? 'Refresh' : 'Build'}
                      </button>
                    </div>

                    <div className="flex-1">
                      {outreachData[match.name] ? (
                        <div className="space-y-4">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Primary Email</span>
                              <ActionButtons text={outreachData[match.name].primaryEmail} label="Primary Email" />
                            </div>
                            <p className="text-[11px] text-slate-800 line-clamp-3 leading-relaxed font-medium">
                              {outreachData[match.name].primaryEmail}
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button 
                              onClick={() => setActiveModal({ type: 'followups', employer: match.name })}
                              className="flex flex-col items-center justify-center gap-1 py-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 hover:bg-slate-50 shadow-sm outline-none"
                              title="Follow-ups"
                            >
                              <MailIcon size={16} className="text-blue-600" />
                              <span className="text-[9px] uppercase font-black">Emails</span>
                            </button>
                            <button 
                              onClick={() => setActiveModal({ type: 'linkedin', employer: match.name })}
                              className="flex flex-col items-center justify-center gap-1 py-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 hover:bg-slate-50 shadow-sm outline-none"
                              title="LinkedIn DM"
                            >
                              <Linkedin size={16} className="text-blue-600" />
                              <span className="text-[9px] uppercase font-black">Social</span>
                            </button>
                            <button 
                              onClick={() => setActiveModal({ type: 'script', employer: match.name })}
                              className="flex flex-col items-center justify-center gap-1 py-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 hover:bg-slate-50 shadow-sm outline-none"
                              title="Call Script"
                            >
                              <Phone size={16} className="text-blue-600" />
                              <span className="text-[9px] uppercase font-black">Call</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-32 bg-slate-50 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200">
                          <span className="text-slate-400 text-[10px] font-bold italic">Awaiting build...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'linkedin' && (
            <div className="space-y-8 animate-in fade-in duration-700 pb-16">
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#0077b5] text-white rounded-2xl shadow-lg">
                    <Linkedin size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Step 5: LinkedIn Content Engine</h2>
                    <p className="text-sm text-slate-500 font-bold italic">High-Impact Employer-Focused Campaigns</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                  <button 
                    onClick={handleGenerateLinkedin}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl font-black shadow-xl transition-all hover:scale-105 active:scale-95 outline-none"
                  >
                    <Sparkle size={18} />
                    Generate 10-Post Strategy
                  </button>
                  {linkedinPosts.length > 0 && (
                    <button 
                      onClick={handleCopyAllLinkedInPosts}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#0077b5] hover:bg-[#005c8c] text-white px-6 py-3.5 rounded-2xl font-black shadow-xl transition-all hover:scale-105 active:scale-95 outline-none"
                    >
                      <CopyCheck size={18} />
                      Copy All
                    </button>
                  )}
                </div>
              </header>

              {linkedinPosts.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] p-16 text-center border border-slate-200 shadow-sm space-y-6">
                  <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Linkedin size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Ready to Scale Your Reach?</h3>
                  <p className="text-slate-500 max-w-md mx-auto font-medium">Click the button above to generate 10 unique, ROI-focused LinkedIn posts tailored to your program's goals and target industries.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-12">
                  {linkedinPosts.map((post, idx) => (
                    <div key={idx} className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden group">
                      <div className="p-1 px-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Post Campaign Day 0{idx + 1}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`h-1.5 w-1.5 rounded-full ${post.imageUrl ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                          <span className="text-[9px] font-black text-slate-400 uppercase">{post.imageUrl ? 'Graphic Ready' : 'Reviewing Copy'}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-12">
                        {/* Editor Section */}
                        <div className="lg:col-span-7 p-8 lg:p-10 space-y-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                              <Layers size={18} />
                            </div>
                            <div>
                              <h3 className="font-black text-slate-900 uppercase text-xs tracking-wider">Campaign Pillar</h3>
                              <p className="text-lg font-bold text-blue-600">{post.pillar}</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Engagement Copy</label>
                            <textarea
                              value={post.content}
                              onChange={(e) => handleUpdatePost(idx, { content: e.target.value })}
                              className="w-full min-h-[180px] p-6 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 leading-relaxed text-sm transition-all"
                              placeholder="Edit post content..."
                            />
                          </div>

                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 flex items-center gap-2">
                                <Hash size={12} /> Active Hashtags
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {post.hashtags.map((tag, tIdx) => (
                                  <div key={tIdx} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-black border border-blue-100 flex items-center gap-1.5 animate-in zoom-in-95">
                                    #{tag}
                                    <button 
                                      onClick={() => handleUpdatePost(idx, { hashtags: post.hashtags.filter((_, i) => i !== tIdx) })}
                                      className="hover:text-red-500 transition-colors"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                                {post.hashtags.length === 0 && (
                                  <p className="text-xs text-slate-400 font-bold italic py-1.5">No hashtags added yet.</p>
                                )}
                              </div>
                            </div>

                            {/* Hashtag Booster Section */}
                            <div className="space-y-3 p-5 bg-slate-50 border border-slate-200 rounded-2xl">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block flex items-center gap-2">
                                  <TrendingIcon size={12} className="text-emerald-500" /> Suggested Booster Tags
                                </label>
                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">High Visibility</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {suggestedHashtagsBank
                                  .filter(tag => !post.hashtags.includes(tag))
                                  .slice(0, 8)
                                  .map((tag, sIdx) => (
                                    <button
                                      key={sIdx}
                                      onClick={() => handleUpdatePost(idx, { hashtags: [...post.hashtags, tag] })}
                                      className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm active:scale-95"
                                    >
                                      + #{tag}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          </div>

                          <div className="pt-6 flex flex-wrap gap-4">
                            <button 
                              onClick={() => copyToClipboard(`${post.content}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`)}
                              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-lg"
                            >
                              <Copy size={18} /> Copy Text & Tags
                            </button>
                            <ActionButtons text={post.content} label={`LinkedIn Post ${idx + 1}`} />
                          </div>
                        </div>

                        {/* Visual Section */}
                        <div className="lg:col-span-5 bg-slate-50 border-l border-slate-100 p-8 lg:p-10 flex flex-col items-center">
                          <div className="w-full max-w-[320px] aspect-square bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative group/img">
                            {post.imageUrl ? (
                              <img src={post.imageUrl} alt="Generated" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                                {generatingImages[idx] ? (
                                  <>
                                    <Loader2 size={48} className="text-blue-600 animate-spin" />
                                    <p className="text-sm font-bold text-slate-500 animate-pulse">Designing Graphic...</p>
                                  </>
                                ) : (
                                  <>
                                    <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center">
                                      <ImageIcon size={32} />
                                    </div>
                                    <p className="text-xs font-bold text-slate-400">Click below to build a custom AI background for this post.</p>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="w-full max-w-[320px] mt-8 space-y-3">
                            <button 
                              onClick={() => handleGenerateGraphic(idx)}
                              disabled={generatingImages[idx]}
                              className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-sm transition-all shadow-lg disabled:opacity-50 ${
                                post.imageUrl 
                                ? 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50' 
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              <RefreshCw size={18} className={generatingImages[idx] ? 'animate-spin' : ''} />
                              {post.imageUrl ? 'Regenerate Graphic' : 'Generate Graphic'}
                            </button>

                            {post.imageUrl && (
                              <div className="grid grid-cols-2 gap-3">
                                <button 
                                  onClick={() => handleDownloadImage(post.imageUrl!, `Post_${idx + 1}`)}
                                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                                >
                                  <Download size={16} /> Download
                                </button>
                                <button 
                                  onClick={() => handleShareImage(post.imageUrl!, post.pillar)}
                                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                                >
                                  <Share2 size={16} /> Share
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Mobile Preview Aesthetic Hint */}
                          <div className="mt-auto pt-8">
                            <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                              <Eye size={14} /> Mobile Feed Visualized
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'chat' && (
            <div className="flex flex-col flex-1 animate-in fade-in duration-700 overflow-hidden min-h-0">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
                <header className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h2 className="font-black text-slate-900">AEGE Assistant</h2>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Conversational Intake</p>
                    </div>
                  </div>
                  <button onClick={() => setChatMessages([])} className="text-xs font-black text-slate-400 hover:text-red-500 uppercase">Clear</button>
                </header>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 min-h-0">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <MessageSquare className="text-blue-600 opacity-20" size={64} />
                      <p className="text-slate-500 font-bold">What is the name of your apprenticeship program?</p>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white'}`}>
                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                      </div>
                      <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-bold shadow-sm ${msg.role === 'user' ? 'bg-white border border-slate-200 text-slate-900' : 'bg-blue-600 text-white'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && <div className="animate-pulse text-blue-600 text-xs font-bold pl-12">Assistant is thinking...</div>}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-6 bg-white border-t border-slate-100 shrink-0">
                  <div className="relative flex items-center">
                    <input 
                      type="text" value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      placeholder="Type here..."
                      className="w-full p-4 pr-14 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-900"
                    />
                    <button onClick={() => handleSendChat()} disabled={isChatLoading} className="absolute right-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50">
                      <Send size={18} />
                    </button>
                  </div>
                  {hasSubstantialData && (
                    <button onClick={() => setStep('intake')} className="w-full mt-4 bg-slate-900 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-black transition-colors">
                      Finish Intake & Open Form <ArrowRight size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Asset Detail Modal */}
      {activeModal && outreachData[activeModal.employer] && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 md:p-6 border-b border-slate-200 flex justify-between items-center bg-slate-100">
              <div className="min-w-0 pr-4">
                <h2 className="text-lg md:text-xl font-bold text-slate-900 truncate">
                  {activeModal.type === 'followups' ? 'Follow-up Sequence' : activeModal.type === 'linkedin' ? 'LinkedIn Social Message' : 'Direct Call Script'}
                </h2>
                <p className="text-xs text-blue-700 font-black truncate uppercase tracking-wide">{activeModal.employer}</p>
              </div>
              <button onClick={() => { setActiveModal(null); stopSpeech(); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-900 flex-shrink-0">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto space-y-6">
              {activeModal.type === 'followups' ? (
                outreachData[activeModal.employer].followUps.map((text, i) => (
                  <div key={i} className="space-y-2 border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Touch {i + 1}</span>
                      <ActionButtons text={text} label={`Follow-up ${i + 1}`} />
                    </div>
                    <p className="text-slate-800 font-bold leading-relaxed text-xs md:text-sm bg-slate-50 p-4 rounded-xl border border-slate-200 italic">"{text}"</p>
                  </div>
                ))
              ) : activeModal.type === 'linkedin' ? (
                <div className="space-y-4">
                   <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tailored Direct Message</span>
                    <ActionButtons text={activeModal.employer ? outreachData[activeModal.employer].linkedInMessage : ''} label="LinkedIn Message" />
                  </div>
                   <p className="text-slate-800 font-bold leading-relaxed text-xs md:text-sm bg-blue-50 p-6 rounded-2xl border border-blue-200 italic">
                    "{activeModal.employer ? outreachData[activeModal.employer].linkedInMessage : ''}"
                   </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Conversation Guide</span>
                    <ActionButtons text={activeModal.employer ? outreachData[activeModal.employer].callScript.join('\n') : ''} label="Call Script" />
                  </div>
                  <ul className="space-y-3">
                    {activeModal.employer && outreachData[activeModal.employer].callScript.map((point, i) => (
                      <li key={i} className="flex gap-3 text-slate-900 font-bold text-xs md:text-sm bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <div className="w-5 h-5 bg-blue-600 text-white rounded-md flex items-center justify-center font-black text-[9px] shrink-0 mt-0.5">{i + 1}</div>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-200 flex justify-end bg-slate-50">
              <button onClick={() => { setActiveModal(null); stopSpeech(); }} className="w-full sm:w-auto px-10 py-3 bg-slate-900 text-white rounded-xl font-black hover:bg-black transition-colors shadow-lg text-sm">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Sticky */}
      {showComplianceSticky && !['landing', 'docs', 'terms'].includes(step) && (
        <div 
          className="fixed bottom-6 right-6 z-[80] w-[340px] md:w-[400px] animate-in slide-in-from-bottom-10 duration-500"
          style={{ left: `calc(${isActuallyExpanded ? '16rem' : '5rem'} + 1.5rem)` }}
        >
          <div className="relative group/sticky overflow-hidden bg-white/90 backdrop-blur-xl border border-amber-200 rounded-[2rem] shadow-2xl shadow-slate-900/10">
            {/* Design accents */}
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
            
            <div className="p-5">
              <header className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                    <ShieldAlert size={18} />
                  </div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Compliance & Strategy</h3>
                </div>
                <button 
                  onClick={() => setShowComplianceSticky(false)} 
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </header>
              
              <div className="space-y-3">
                <p className="text-[11px] leading-relaxed text-slate-700 font-bold">
                  AI-generated insights are for <span className="text-slate-900 font-black">strategic planning only.</span> Outreach must be reviewed for EEO compliance and local labor standards.
                </p>
                
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                  <div className="flex gap-2.5">
                    <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-black text-amber-900 italic leading-tight uppercase tracking-tight">
                      "Participation does not guarantee hiring outcomes or program eligibility."
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <button 
                    onClick={() => setStep('terms')}
                    className="text-[10px] font-black text-blue-600 hover:text-blue-700 underline underline-offset-4 uppercase tracking-wider transition-colors"
                  >
                    View Full Legal Terms
                  </button>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">v2.1 Compliance</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
