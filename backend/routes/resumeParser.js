import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// --- CHANGED LINES BELOW ---
// We use 'require' instead of 'import' for these libraries
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
// ---------------------------

/**
 * Parse Resume and Extract Candidate Information
 */
export const parseResume = async (fileBuffer, mimetype) => {
  try {
    let text = '';

    // Extract text based on file type
    if (mimetype === 'application/pdf') {
      const pdfData = await pdfParse(fileBuffer);
      text = pdfData.text;
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      text = result.value;
    } else {
      throw new Error('Unsupported file format');
    }

    // Extract information from text
    const extractedData = extractInformation(text);

    return {
      success: true,
      data: extractedData,
      rawText: text
    };
  } catch (error) {
    console.error('Resume parsing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Extract structured information from resume text
 */
const extractInformation = (text) => {
  const lines = text.split('\n').filter(line => line.trim());

  return {
    name: extractName(lines),
    email: extractEmail(text),
    contact: extractPhone(text),
    linkedin: extractLinkedIn(text),
    gender: extractGender(text),
    skills: extractSkills(text),
    totalExperience: extractExperience(text),
    education: extractEducation(text),
    currentCompany: extractCurrentCompany(text),
    currentLocation: extractLocation(text),
  };
};

/**
 * Extract name (usually first non-empty line)
 */
const extractName = (lines) => {
  for (let line of lines) {
    const trimmed = line.trim();
    // Name is typically 2-4 words, starts with capital letter
    if (trimmed.length > 3 && trimmed.length < 50 && /^[A-Z]/.test(trimmed)) {
      const words = trimmed.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        // Check if it's not a section header
        if (!/(resume|curriculum|vitae|profile|summary|objective|experience|education|skills)/i.test(trimmed)) {
          return trimmed;
        }
      }
    }
  }
  return '';
};

/**
 * Extract email address
 */
const extractEmail = (text) => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex);
  return emails ? emails[0] : '';
};

/**
 * Extract LinkedIn profile format
 */
const extractLinkedIn = (text) => {
  const linkedinRegex = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in\/|pub\/|profile\/)?([a-zA-Z0-9_-]+)\/?/i;
  const match = text.match(linkedinRegex);
  return match ? match[0] : '';
};

/**
 * Extract phone number
 */
const extractPhone = (text) => {
  // Indian phone number patterns
  const patterns = [
    /(\+91[\s-]?)?[6-9]\d{9}/g, // Indian mobile with optional +91
    /\b\d{10}\b/g, // 10 digit number
    /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g, // (123) 456-7890
  ];

  for (let pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      let phone = matches[0].replace(/[\s()-]/g, '');
      // If starts with +91, remove it
      if (phone.startsWith('+91')) {
        phone = phone.substring(3);
      } else if (phone.startsWith('91') && phone.length === 12) {
        phone = phone.substring(2);
      }
      return phone;
    }
  }
  return '';
};

/**
 * Extract Gender
 */
const extractGender = (text) => {
  // Look for explicit indicators like "Gender: Male" or just the words near personal details
  const match = text.match(/(?:gender|sex)[\s:-]+(male|female|other)\b/i) || text.match(/\b(male|female)\b/i);
  if (match) {
    const gender = match[1].toLowerCase();
    return gender.charAt(0).toUpperCase() + gender.slice(1);
  }
  return 'Not Specified';
};

/**
 * Extract skills
 */
const extractSkills = (text) => {
  const commonSkills = [
    'JavaScript', 'Java', 'Python', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Go',
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'ASP.NET',
    'HTML', 'CSS', 'SASS', 'TypeScript', 'jQuery', 'Bootstrap', 'Tailwind',
    'MongoDB', 'MySQL', 'PostgreSQL', 'Oracle', 'SQL Server', 'Redis', 'Cassandra',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'Git', 'CI/CD',
    'REST API', 'GraphQL', 'Microservices', 'Agile', 'Scrum', 'JIRA',
    'Machine Learning', 'AI', 'Data Science', 'TensorFlow', 'PyTorch',
    'Salesforce', 'SAP', 'Oracle ERP', 'Power BI', 'Tableau',
    'Selenium', 'JUnit', 'Jest', 'Mocha', 'Cypress',
  ];

  const foundSkills = [];
  const textLower = text.toLowerCase();

  for (let skill of commonSkills) {
    const skillLower = skill.toLowerCase();
    // Use word boundary to match whole words
    const regex = new RegExp(`\\b${skillLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(textLower)) {
      foundSkills.push(skill);
    }
  }

  return foundSkills.join(', ');
};

/**
 * Extract total years of experience
 */
const extractExperience = (text) => {
  // 1. Look for explicit total experience with strict patterns
  const explicitPatterns = [
    /(?:total|overall|cumulative)\s+(?:experience|exp)[\s:-]+(\d+\.?\d*)\+?\s*(?:years?|yrs?)/gi,
    /(\d+\.?\d*)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:total|overall|cumulative)\s*(?:experience|exp)/gi
  ];

  for (let pattern of explicitPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches && matches.length > 0) {
      return matches[0][1];
    }
  }

  // 2. Safely isolate Experience section, strict boundaries to avoid Education dates
  const lines = text.split('\n');
  let inExp = false;
  let expText = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if it's a heading (usually short)
    if (trimmed.length < 80) {
      const cleanStr = trimmed.toLowerCase().replace(/[^a-z]/g, '');

      // Match common experience headers
      const isExpHeading = /^(work)?experience|employment(history)?|professionalexperience|careerhistory/.test(cleanStr);

      // Match other sections to know when to stop
      const isOtherHeading = /^(education|academic|qualification|skill|project|certification|reference|personal|hobby|achievement|language|declaration|summary|objective|profile)/.test(cleanStr);

      if (isExpHeading && !isOtherHeading) {
        inExp = true;
        continue; // start collecting after header
      } else if (isOtherHeading && inExp) {
        inExp = false; // hit another section, stop collecting
      }
    }

    if (inExp) {
      expText.push(line);
    }
  }

  let sectionToUse = expText.length > 0 ? expText.join('\n') : '';

  // Fallback: If no lines were isolated (e.g., pdf-parse removed newlines), use regex boundaries
  if (!sectionToUse) {
    const expMatch = text.match(/\b(?:work\s+)?experience(?:s)?\b|\bemployment(?: history)?\b|\bprofessional\s+experience\b|\bcareer\s+history\b/i);
    if (expMatch) {
      const stopRegex = /\b(?:education|academic|qualifications?|skills?|projects?|certifications?|references?|personal details|hobbies|achievements?|languages?|declarations?)\b/gi;
      stopRegex.lastIndex = expMatch.index + 20;
      const stopMatch = stopRegex.exec(text);

      if (stopMatch && stopMatch.index > expMatch.index) {
        sectionToUse = text.substring(expMatch.index, stopMatch.index);
      } else {
        sectionToUse = text.substring(expMatch.index);
      }
    }
  }

  // 3. Calculate from explicit date ranges exclusively within the isolated experience section
  if (sectionToUse) {
    const dateRangePattern = /\b(19\d{2}|20\d{2})\b\s*(?:[-–]|to|till|until)\s*\b(19\d{2}|20\d{2}|present|current|now|till date|today)\b/gi;
    const ranges = [...sectionToUse.matchAll(dateRangePattern)];

    if (ranges.length > 0) {
      let workedYears = new Set();
      const currentYear = new Date().getFullYear();

      for (let match of ranges) {
        let startYear = parseInt(match[1]);
        let endYearStr = match[2].toLowerCase();
        let endYear = currentYear;

        if (/\d{4}/.test(endYearStr)) {
          endYear = parseInt(endYearStr);
        }

        // Consider realistic job bounds (exclude things that look too far back or future)
        if (endYear >= startYear && (endYear - startYear) < 40 && startYear > 1960 && endYear <= currentYear) {
          for (let y = startYear; y < endYear; y++) {
            workedYears.add(y);
          }
          if (endYear === startYear) {
            workedYears.add(startYear); // minimum 1 year consideration
          }
        }
      }

      if (workedYears.size > 0) {
        return workedYears.size.toString();
      }
    }

    // 4. Sum isolated durations (e.g. "3 years", "2 yrs") purely located in Experience section
    let durationSum = 0;
    const durationPattern = /(\d+\.?\d*)\s*(?:years?|yrs?)\b/gi;
    const durations = [...sectionToUse.matchAll(durationPattern)];
    for (let match of durations) {
      let val = parseFloat(match[1]);
      if (val > 0 && val < 40) {
        durationSum += val;
      }
    }
    if (durationSum > 0) {
      return durationSum.toString();
    }
  }

  return '';
};

/**
 * Extract education - finds the highest qualification based on hierarchy
 */
const extractEducation = (text) => {
  // Ordered by highest priority first
  const degreeHierarchy = [
    { regex: /\b(Ph\.?D\.|Doctorate)\b/i, label: 'PhD' },
    { regex: /\b(M\.?Tech|Masters? of Technology)\b/i, label: 'M.Tech' },
    { regex: /\b(M\.?E|Masters? of Engineering)\b/i, label: 'M.E' },
    { regex: /\b(MBA|Masters? of Business Administration)\b/i, label: 'MBA' },
    { regex: /\b(MCA|Masters? of Computer Applications?)\b/i, label: 'MCA' },
    { regex: /\b(M\.?Sc|Masters? of Science)\b/i, label: 'M.Sc' },
    { regex: /\b(M\.?Com|Masters? of Commerce)\b/i, label: 'M.Com' },
    { regex: /\b(Masters?.*?)\b/i, label: 'Master\'s Degree' },

    { regex: /\b(B\.?Tech|Bachelors? of Technology)\b/i, label: 'B.Tech' },
    { regex: /\b(B\.?E|Bachelors? of Engineering)\b/i, label: 'B.E' },
    { regex: /\b(BCA|Bachelors? of Computer Applications?)\b/i, label: 'BCA' },
    { regex: /\b(BBA|Bachelors? of Business Administration)\b/i, label: 'BBA' },
    { regex: /\b(B\.?Sc|Bachelors? of Science)\b/i, label: 'B.Sc' },
    { regex: /\b(B\.?Com|Bachelors? of Commerce)\b/i, label: 'B.Com' },
    { regex: /\b(Bachelors?.*?)\b/i, label: 'Bachelor\'s Degree' },
  ];

  // Try to find the exact line context for the highest degree
  for (let degree of degreeHierarchy) {
    if (degree.regex.test(text)) {
      // Find the specific line containing this highest qualification to give contextual info
      const lines = text.split('\n');
      for (let line of lines) {
        if (degree.regex.test(line)) {
          let clean = line.trim();

          // Cut aggressively at common delimiters
          clean = clean.split(/[,|\-\(\);]/)[0].trim();

          // Stop at common separator words that indicate the end of the degree name
          const stopPattern = /\b(postgraduate|graduate|with|from|at|cgpa|percentage|\d+%|score|marks|board|university|college|school|passed)\b/i;
          const stopMatch = clean.match(stopPattern);
          if (stopMatch) {
            clean = clean.substring(0, stopMatch.index).trim();
          }

          // If the remaining string is clean and short enough, return it. Otherwise fallback to base label.
          return clean && clean.length <= 40 ? clean : degree.label;
        }
      }
      return degree.label; // Fallback to basic label if line logic misses
    }
  }

  return '';
};

/**
 * Extract current company
 */
const extractCurrentCompany = (text) => {
  const patterns = [
    /(?:currently working|current(?:ly)?\s+at|working\s+at|employed\s+at)[:\s]+([^\n]+)/gi,
    /(?:present|current)[^\n]*?(?:company|organization|employer)[:\s]+([^\n]+)/gi,
  ];

  for (let pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().split(/[,\n]/)[0].trim();
    }
  }

  return '';
};

/**
 * Extract location
 */
const extractLocation = (text) => {
  const indianCities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata',
    'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur',
    'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri', 'Patna',
    'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad',
    'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad',
    'Amritsar', 'Navi Mumbai', 'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore',
    'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur',
    'Kota', 'Chandigarh', 'Guwahati', 'Noida', 'Gurugram', 'Gurgaon'
  ];

  const textLower = text.toLowerCase();

  for (let city of indianCities) {
    if (textLower.includes(city.toLowerCase())) {
      return city;
    }
  }

  return '';
};