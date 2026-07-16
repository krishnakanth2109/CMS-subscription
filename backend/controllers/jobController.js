import Job from '../models/Job.js';
import Groq from 'groq-sdk';

export const getJobs = async (req, res) => {
  try {
    let query = {};
    if (req.user && req.user.role === 'recruiter') {
      const possibleNames = [
        (req.user.firstName && req.user.lastName) ? `${req.user.firstName} ${req.user.lastName}` : null,
        req.user.name, req.user.fullName, req.user.username, req.user.email
      ].filter(Boolean);

      query = {
        $or: [
          { primaryRecruiter: { $in: possibleNames } },
          { secondaryRecruiter: { $in: possibleNames } }
        ]
      };
    }
    const jobQuery = Job.find(query).sort({ createdAt: -1 });
    if (req.query.view === 'lookup') {
      jobQuery.select('_id jobCode clientName position location active primaryRecruiter secondaryRecruiter');
    } else if (req.query.view === 'dashboard') {
      jobQuery.select('_id jobCode clientName position location active primaryRecruiter secondaryRecruiter assignedRecruiter recruiterId createdAt');
    }
    const jobs = await jobQuery.lean();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createJob = async (req, res) => {
  try {
    const jobData = { ...req.body, createdBy: req.user._id };

    if (!jobData.tatTime || jobData.tatTime === "") {
      jobData.tatTime = null;
    }

    // ROBUST AUTO-INCREMENT LOGIC
    // 1. Get all jobs that start with REQ
    const allJobs = await Job.find({ jobCode: /^REQ/ }, { jobCode: 1 }).lean();
    
    let maxNum = 0;
    if (allJobs.length > 0) {
      // 2. Extract numeric parts and find the absolute maximum
      const nums = allJobs.map(j => {
        const match = j.jobCode.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
      maxNum = Math.max(...nums);
    }

    // 3. Set new job code (e.g., REQ0005)
    jobData.jobCode = `REQ${String(maxNum + 1).padStart(4, '0')}`;

    const job = await Job.create(jobData);
    res.status(201).json(job);
  } catch (error) {
    console.error("Create Job Error:", error); 
    res.status(400).json({ message: error.code === 11000 ? "Job Code collision. Try again." : error.message });
  }
};

export const updateJob = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.tatTime === "") updateData.tatTime = null;

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, updateData, { new: true }).lean();
    if (!updatedJob) return res.status(404).json({ message: 'Job not found' });
    res.json(updatedJob);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    await job.deleteOne();
    res.json({ message: 'Job removed'});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generateJobDescription = async (req, res) => {
  try {
    const {
      position,
      clientName,
      jobType,
      location,
      experience,
      relevantExperience,
      qualification,
      salaryBudget,
      skills,
      preferredSkills,
    } = req.body;

    if (!position) {
      return res.status(400).json({ message: "Position / Role is required to generate a JD." });
    }

    if (!process.env.GROQ_API_KEY) {
      const fallbackJD = `### 💼 Job Description: ${position}

- **🏢 Company:** ${clientName || 'Confidential'}
- **📅 Job Type:** ${jobType || 'Full-Time'}
- **📍 Location:** ${location || 'Not Specified'}
- **⏳ Experience Required:** ${experience || 'Not Specified'}

#### 🚀 About the Role
We are looking for a qualified ${position} to join our team. You will be responsible for driving success in this domain and collaborating with cross-functional teams.

#### 📋 Key Responsibilities
- Design, build, and maintain efficient, reusable, and reliable systems.
- Collaborate with project managers, clients, and technical teams.
- Troubleshoot, debug, and upgrade existing systems.
- Implement security and data protection solutions.

#### 🔑 Required Skills & Qualifications
- **Mandatory Skills:** ${skills || 'Not Specified'}
- **Preferred Skills:** ${preferredSkills || 'Not Specified'}
- **Qualification:** ${qualification || 'Bachelor\'s degree in a relevant field'}
- **Relevant Experience:** ${relevantExperience || experience || 'Not Specified'}

#### 🎁 What We Offer
- Competitive salary budget: ${salaryBudget || 'As per industry standards'}.
- Professional growth and learning opportunities.
- A collaborative and inclusive work environment.`;
      return res.json({ text: fallbackJD });
    }

    const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const prompt = `You are a professional HR and Talent Acquisition specialist. Draft a highly professional, well-formatted Job Description (JD) suitable for a premier job portal (like LinkedIn, Indeed, or Naukri), based on the following job details.

Job Details:
- Role/Position: ${position}
- Client/Company: ${clientName || 'Confidential'}
- Job Type: ${jobType || 'Full-Time'}
- Location: ${location || 'Not Specified'}
- Experience required: ${experience || 'Not Specified'}
- Relevant Experience: ${relevantExperience || 'Not Specified'}
- Qualification: ${qualification || 'Not Specified'}
- Salary Budget: ${salaryBudget || 'As per industry standards'}
- Mandatory Skills: ${skills || 'Not Specified'}
- Preferred Skills: ${preferredSkills || 'Not Specified'}

Format the output cleanly using Markdown. Include relevant professional emojis/icons at the beginning of each major section, subsection, and key highlights (e.g. 💼, 🏢, 📍, 💰, 🚀, 📋, 🔑, 🎓, 🤝, 🌟) to make the JD visually engaging, structured, and modern.

Include the following sections:
1. **🏢 About the Role / Summary**
2. **📋 Key Responsibilities**
3. **🔑 Required Skills & Qualifications** (Explicitly separate Mandatory and Preferred Skills)
4. **🎓 Experience & Education**
5. **💰 Benefits & Compensation**

Return ONLY the formatted Job Description in Markdown. Do not include introductory or concluding conversational text, and do not wrap it in markdown code block ticks.`;

    const chatCompletion = await groqClient.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1500,
    });

    const jdText = chatCompletion.choices[0]?.message?.content || "";
    res.json({ text: jdText });
  } catch (error) {
    console.error('[generateJD] Groq Error:', error.message);
    res.status(500).json({ message: `Failed to generate Job Description: ${error.message}` });
  }
};