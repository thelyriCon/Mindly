/**
 * Practical Knowledge and Skill Discovery Engine
 * Generates and serves high-yield educational micro-articles focused on
 * actionable skills, foundational concepts, real-world problem-solving,
 * and competencies users can apply in employment, entrepreneurship,
 * professional development, further education, and everyday life.
 *
 * Aligned with the 6 core learning catalogue categories:
 * 1. Artificial Intelligence & Automation
 * 2. Data Analysis & Digital Literacy
 * 3. Cybersecurity & IT
 * 4. Software Development & Technology
 * 5. Design, UX & Creativity
 * 6. Content Creation & Digital Media
 */

import { GoogleGenAI } from '@google/genai';
import { MicroArticle } from '../../src/types';
import { searchWikimediaImages, cleanImageUrl } from './mediaService';
import { callGeminiWithRetry } from './aiService';

const TOPIC_STOCK_FALLBACKS: Record<string, string> = {
  ai: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&q=80',
  automation: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
  data: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
  sql: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=800&q=80',
  security: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=800&q=80',
  cloud: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
  network: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80',
  code: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
  python: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
  design: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
  video: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80',
  content: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80',
  general: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
};

function getStockFallback(topic: string = '', category: string = ''): string {
  const t = `${topic} ${category}`.toLowerCase();
  for (const [k, url] of Object.entries(TOPIC_STOCK_FALLBACKS)) {
    if (t.includes(k)) return url;
  }
  return TOPIC_STOCK_FALLBACKS.general;
}

// Curated library strictly adhering to the Practical Learning Standard across the 6 core categories
export const CURATED_MICRO_ARTICLES: MicroArticle[] = [
  // ==========================================
  // CATEGORY 1: Artificial Intelligence and Automation
  // ==========================================
  {
    id: 'ma-ai-01',
    topic: 'Prompt Engineering & AI Tools',
    category: 'Artificial Intelligence & Automation',
    headline: 'Context Structuring & Few-Shot Prompting: Driving Deterministic AI Workflows',
    snippet:
      'Vague, single-sentence prompts generate generic, unreliable AI outputs that require extensive manual editing. Structuring prompts with explicit role framing, few-shot demonstration pairs, and negative constraints converts probabilistic language models into reliable professional automation tools.',
    fullContent: `Real-World Challenge & Context:
When professionals adopt AI tools like ChatGPT or Gemini for complex tasks—such as extracting data from contracts, synthesizing market reports, or generating code—they often encounter inconsistent formatting, hallucinations, or conversational fluff. Treating an LLM like an omniscient chat partner leads to unpredictable variations that cannot be integrated into serious business pipelines.

Core Principle & Mechanism:
Large language models operate by predicting the most statistically probable next token given the prompt's context window. Without clear structural boundaries, the model samples across broad, generic training data. Implementing Few-Shot Prompting provides explicit input-output demonstration pairs that establish the target pattern in in-context memory. When combined with Role Framing, delimiters (e.g. XML tags or Markdown headers), and output schema enforcement (JSON/Markdown tables), the model's probability distribution concentrates tightly on the desired format.

Step-by-Step Practical Application:
To build production-grade prompt templates: Step 1: Assign a specific professional identity (e.g., "Act as a Senior Financial Analyst"). Step 2: Separate source materials from instructions using distinct tags like <source_text>...</source_text>. Step 3: Provide 2 to 3 pristine examples demonstrating the exact desired input-to-output mapping. Step 4: Include negative constraints (e.g., "Never guess missing figures; output null if unverified"). Step 5: Specify deterministic output structure such as JSON keys or bulleted takeaways.

Actionable Competency & Next Steps:
Mastering prompt engineering enables you to automate document triage, extract structured metrics from unstructured emails, and author standardized reports in seconds. Expanding this foundation into a full course teaches agentic chaining, retrieval-augmented generation (RAG), and API-driven automation.`,
    keyInsight: 'Providing explicit few-shot input-output examples conditions the language model to produce consistent, structured business outputs.',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Structured prompt conditioning and token probability distribution in modern LLMs',
    suggestedCourseTitle: 'Practical Prompt Engineering & AI Workflows',
    tags: ['AI Tools', 'Automation', 'Productivity'],
    readTime: '2 min',
  },
  {
    id: 'ma-ai-02',
    topic: 'AI Workflow Automation',
    category: 'Artificial Intelligence & Automation',
    headline: 'Autonomous Webhooks: Connecting LLMs to Practical Business Pipelines',
    snippet:
      'Using AI via isolated browser chat interfaces creates manual copy-paste bottlenecks. Connecting language models to automated trigger-action webhooks via Zapier, Make, or custom microservices allows businesses to parse inbound leads, categorize support tickets, and update databases hands-free.',
    fullContent: `Real-World Challenge & Context:
Small business owners, operations managers, and consultants spend hours every day manually copying client inquiries from emails, formatting them into spreadsheet rows, drafting preliminary responses, and creating calendar events. Even when using AI tools, manual copy-pasting between browser tabs limits throughput and introduces human data entry errors.

Core Principle & Mechanism:
Modern workflow automation connects asynchronous software systems using HTTP Webhooks and RESTful APIs. When a customer submits an inquiry form, an HTTP POST payload fires to an automation webhook endpoint. An integrated AI node receives this structured JSON payload, runs a standardized extraction prompt to identify customer sentiment, urgency, and core requests, and passes the parsed fields to subsequent cloud services—such as CRM databases or messaging queues—without human intervention.

Step-by-Step Practical Application:
To implement an automated AI pipeline: First, configure a webhook trigger on your intake channel (e.g., Typeform or Google Forms). Second, route the webhook to an API endpoint or workflow automation platform (Make/Zapier/Node.js). Third, format the incoming text into an LLM API call with a JSON schema response format. Fourth, pass the validated JSON directly into your destination database (Airtable, PostgreSQL, or Notion). Fifth, configure error handling and fallback alerts to notify your team if API latency exceeds thresholds.

Actionable Competency & Next Steps:
Building webhook-driven AI automations allows you to scale business operations without increasing administrative headcount. This skill provides the bridge to enterprise robotic process automation (RPA) and serverless cloud architectures.`,
    keyInsight: 'Replacing browser copy-pasting with webhook-triggered AI endpoints automates lead triage and CRM updates automatically.',
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Event-driven webhook routing and automated cloud data pipelines',
    suggestedCourseTitle: 'AI Workflow Automation & Integration',
    tags: ['Automation', 'APIs', 'Business Operations'],
    readTime: '2 min',
  },
  {
    id: 'ma-ai-03',
    topic: 'AI Agents & Tool Use',
    category: 'Artificial Intelligence & Automation',
    headline: 'The ReAct Framework: How Autonomous AI Agents Reason and Use External Tools',
    snippet:
      'Language models alone cannot check live databases, search real-time web sources, or calculate complex formulas. The ReAct (Reasoning + Acting) architecture empowers AI models to dynamically generate reasoning traces, call specific software functions, and observe results before delivering a verified conclusion.',
    fullContent: `Real-World Challenge & Context:
Standard language models suffer from strict knowledge cutoffs and lack direct calculation capabilities. Asking an AI "What is the current inventory of SKU-402 and will it fulfill next week's projected demand?" causes either hallucinated numbers or a polite refusal. Practical enterprise applications require AI that can actively check stock in an ERP database, query the weather API, and calculate mathematical projections with precision.

Core Principle & Mechanism:
The ReAct framework unifies reasoning and action in language models. When given an objective, the agent loops through three distinct phases: Thought (analyzing current state and planning the next sub-goal), Action (choosing and calling an external tool like a SQL query or calculator via structured function calling), and Observation (inspecting the return value from the tool). By grounding each reasoning step in empirical observation, the agent corrects its course dynamically and solves multi-step analytical challenges.

Step-by-Step Practical Application:
To build a functional ReAct agent: Step 1: Define clear, atomic function signatures (e.g., search_database(query), calculate_roi(principal, rate, years)). Step 2: Provide the model with tool descriptions and parameter schemas. Step 3: Implement an execution loop that parses the model's tool calls, invokes the local Python or TypeScript functions, and feeds the output back into the conversation context. Step 4: Add boundary checks that terminate the loop if an agent exceeds maximum iterations or fails to make progress.

Actionable Competency & Next Steps:
Understanding agentic function calling equips you to build intelligent research assistants, automated code debugging companions, and autonomous customer support systems that interact safely with live databases.`,
    keyInsight: 'The ReAct loop interleaves explicit reasoning thoughts with external function calls to solve complex real-world tasks accurately.',
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Multi-step autonomous agent reasoning traces and tool-call execution loops',
    suggestedCourseTitle: 'Building AI Agents & Function Calling Systems',
    tags: ['AI Agents', 'Function Calling', 'Software'],
    readTime: '2 min',
  },

  // ==========================================
  // CATEGORY 2: Data Analysis and Digital Literacy
  // ==========================================
  {
    id: 'ma-data-01',
    topic: 'Spreadsheet Data Modeling',
    category: 'Data Analysis & Digital Literacy',
    headline: 'XLOOKUP & Dynamic Arrays: Building Resilient Analytical Models in Excel & Sheets',
    snippet:
      'Legacy VLOOKUP formulas break whenever columns shift and slow down large workbooks. Modern XLOOKUP and dynamic array formulas (FILTER, UNIQUE, SORT) eliminate fragile hardcoded column indexes and power automated financial and operational reporting models.',
    fullContent: `Real-World Challenge & Context:
In finance, marketing, and operations, analysts frequently build massive workbooks linking customer orders, inventory lists, and price sheets. Using obsolete VLOOKUP formulas introduces severe vulnerabilities: if an associate inserts a new column anywhere in the sheet, existing formulas reference the wrong data without throwing an error, leading to inaccurate invoices and flawed forecasts.

Core Principle & Mechanism:
Modern spreadsheet engines utilize dynamic array calculation engines and separate lookup arrays from return arrays. Unlike VLOOKUP, XLOOKUP requires only three arguments: the lookup value, the lookup range, and the result range. Because ranges are bound to specific column vectors rather than numeric column offsets, the formula is immune to column insertions or deletions. Furthermore, dynamic array functions like FILTER() evaluate criteria across an entire dataset and spill results into neighboring cells dynamically, replacing hundreds of nested IF statements.

Step-by-Step Practical Application:
To modernize spreadsheet reporting: First, replace all VLOOKUP instances with =XLOOKUP(lookup_value, lookup_array, return_array, "Not Found"). Second, use the fifth parameter (match_mode) for exact matches (0) or wildcard searches (2). Third, replace manual copy-paste filtering with dynamic arrays like =SORT(FILTER(SalesData, SalesRegion="Europe"), 3, -1) to automatically generate real-time ranked regional leaderboards.

Actionable Competency & Next Steps:
Mastering dynamic formulas and structural data modeling transforms you from a basic spreadsheet user into an agile business intelligence analyst capable of building self-updating financial models and executive summaries.`,
    keyInsight: 'XLOOKUP separates lookup and return vectors, ensuring financial formulas never break when spreadsheet columns shift.',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Dynamic array calculations and multi-dimensional financial modeling in spreadsheets',
    suggestedCourseTitle: 'Advanced Excel & Google Sheets for Business Analytics',
    tags: ['Excel', 'Data Analysis', 'Finance'],
    readTime: '2 min',
  },
  {
    id: 'ma-data-02',
    topic: 'SQL Querying',
    category: 'Data Analysis & Digital Literacy',
    headline: 'CTEs and Window Functions: Solving Complex Business Questions in Relational Databases',
    snippet:
      'Nested subqueries quickly become unreadable and inefficient when analyzing customer lifecycles and retention cohorts. Common Table Expressions (CTEs) and Window Functions like ROW_NUMBER() and SUM() OVER() allow analysts to compute running totals and rankings in clean, performant SQL.',
    fullContent: `Real-World Challenge & Context:
Product managers and business analysts often need to answer multi-stage questions: "Who were our top 3 purchasing customers in each country this quarter?" or "What is our month-over-month running revenue total?" Answering this with naive SQL requires deeply nested subqueries and self-joins that take minutes to execute and are impossible for team members to maintain or audit.

Core Principle & Mechanism:
Common Table Expressions (CTEs) declared using the WITH clause act as named temporary result sets, breaking complex analytical problems into linear, readable logical steps. Window Functions perform calculations across a specific set of table rows that are related to the current row, without collapsing the individual rows into a single summary like standard GROUP BY does. Using OVER (PARTITION BY ... ORDER BY ...), the database engine calculates running sums, moving averages, and ranks with optimal single-pass execution.

Step-by-Step Practical Application:
To calculate ranked customer cohorts: First, write a CTE that aggregates total spending per user per region. Second, in the main query, apply ROW_NUMBER() OVER (PARTITION BY region ORDER BY total_spend DESC) AS spend_rank. Third, filter where spend_rank <= 3. For time series, use SUM(revenue) OVER (ORDER BY order_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) to compute instantaneous cumulative revenue.

Actionable Competency & Next Steps:
Proficiency with Window Functions and CTEs is the primary benchmark that separates junior data collectors from senior business intelligence engineers. This knowledge directly translates to PostgreSQL, BigQuery, Snowflake, and MySQL analytics roles.`,
    keyInsight: 'Window functions compute rankings and running metrics across partitions without collapsing individual rows like GROUP BY.',
    imageUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Relational database schema querying and analytical window function execution',
    suggestedCourseTitle: 'SQL Fundamentals & Business Intelligence Querying',
    tags: ['SQL', 'Databases', 'Analytics'],
    readTime: '2 min',
  },
  {
    id: 'ma-data-03',
    topic: 'Data Visualization & Dashboards',
    category: 'Data Analysis & Digital Literacy',
    headline: 'Visual Encoding & Clutter Elimination: Designing Actionable Executive Dashboards',
    snippet:
      '3D pie charts, rainbow color palettes, and redundant gridlines distract stakeholders from critical metrics. Applying visual encoding principles and high data-to-ink ratios ensures dashboards communicate trends, outliers, and operational risks within five seconds of inspection.',
    fullContent: `Real-World Challenge & Context:
Organizations invest millions in business intelligence tools like Tableau, Power BI, and Looker, yet executives frequently complain that dashboards are overwhelming, confusing, or useless. Analysts often cram dozens of colorful widgets onto a single screen, forcing viewers to spend cognitive energy decoding visual clutter rather than making strategic decisions.

Core Principle & Mechanism:
Human visual perception processes certain attributes—such as position along a common scale, bar length, and color intensity—preattentively before conscious thought. Edward Tufte's Data-to-Ink Ratio emphasizes maximizing the proportion of visual elements devoted to displaying genuine information. Replacing 3D pie charts (which distort relative areas) with ranked horizontal bar charts leverages humans' natural ability to judge 1D lengths with high precision.

Step-by-Step Practical Application:
To build an executive-ready dashboard: Step 1: Limit the primary color palette to a single neutral tone (e.g. slate gray) and reserve high-contrast accent colors (such as vibrant blue or amber) exclusively for key targets and anomalies. Step 2: Arrange KPIs in a natural top-to-bottom reading hierarchy, placing headline figures at the top left. Step 3: Remove unnecessary borders, non-essential tick marks, and redundant legends. Step 4: Include contextual reference benchmarks (e.g., target lines or prior-year baselines) for every metric.

Actionable Competency & Next Steps:
Mastering dashboard design empowers you to present compelling business cases to C-suite executives and board members. This skill is critical for data analysts, management consultants, and growth leads.`,
    keyInsight: 'Reserve bright accent colors solely for key anomalies and targets; neutral palettes and clean bar scales deliver instant comprehension.',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'High data-to-ink ratio executive dashboard with contextual variance indicators',
    suggestedCourseTitle: 'Data Visualization & Executive Dashboard Design',
    tags: ['Dashboards', 'Data Viz', 'Communication'],
    readTime: '2 min',
  },

  // ==========================================
  // CATEGORY 3: Cybersecurity and IT
  // ==========================================
  {
    id: 'ma-sec-01',
    topic: 'Cybersecurity Fundamentals',
    category: 'Cybersecurity & IT',
    headline: 'Defense-in-Depth: Protecting User Accounts Against Credential Stuffing & Phishing',
    snippet:
      'Over 80% of data breaches originate from compromised passwords reused across third-party leaks. Implementing Defense-in-Depth—combining salted cryptographic hashing, rate limiting, and FIDO2 hardware authentication—neutralizes automated account takeover attacks.',
    fullContent: `Real-World Challenge & Context:
When a minor website suffers a database breach, criminal syndicates immediately acquire millions of leaked email-and-password combinations. Automated botnets test these combinations across thousands of banking, e-commerce, and SaaS platforms within hours. Websites relying on simple username-password logins face widespread account takeover, customer identity theft, and crippling regulatory liabilities.

Core Principle & Mechanism:
Defense-in-Depth operates on the principle that no single defensive layer is infallible. Security architects implement layered barriers so that if one control fails, adjacent controls prevent total compromise. For password storage, modern systems use adaptive memory-hard hashing algorithms like Argon2id or bcrypt with individual cryptographic salts, preventing rainbow table attacks. For authentication flows, time-based one-time passwords (TOTP) or public-key cryptographic WebAuthn tokens ensure that even a leaked password cannot grant system access without possession of the physical device.

Step-by-Step Practical Application:
To harden application security: Step 1: Enforce bcrypt (cost factor >= 12) or Argon2id for all stored credentials; never store or log plaintext passwords. Step 2: Implement IP and account-based rate limiting (e.g., maximum 5 failed attempts per 15-minute window) using Redis token buckets. Step 3: Require multi-factor authentication (MFA) via authenticator apps or Passkeys rather than vulnerable SMS messages. Step 4: Audit system dependencies continuously with automated vulnerability scanners like npm audit and Snyk.

Actionable Competency & Next Steps:
Understanding authentication security and threat modeling is mandatory for every web developer, DevOps engineer, and IT administrator. This knowledge forms the foundation for security analyst and CISSP certification paths.`,
    keyInsight: 'Layering memory-hard password hashing with rate limiting and hardware MFA neutralizes credential-stuffing botnets.',
    imageUrl: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Hardware-backed multi-factor cryptographic authentication and threat defense',
    suggestedCourseTitle: 'Cybersecurity Fundamentals & Defense-in-Depth',
    tags: ['Cybersecurity', 'Authentication', 'Security'],
    readTime: '2 min',
  },
  {
    id: 'ma-sec-02',
    topic: 'Cloud Infrastructure & Zero Trust',
    category: 'Cybersecurity & IT',
    headline: 'Zero Trust & Least Privilege: Architecting Cloud Infrastructure Without Perimeter Trust',
    snippet:
      'Legacy perimeter security assumes that anyone inside the corporate VPN is trustworthy, allowing attackers who breach one workstation to move laterally across servers. Zero Trust enforces continuous verification, ephemeral credentials, and strict least-privilege IAM policies for every single request.',
    fullContent: `Real-World Challenge & Context:
In traditional network setups, employees connect to a Virtual Private Network (VPN) and gain broad access to internal staging servers, databases, and admin dashboards. When an employee's laptop is compromised via a phishing email or malware, the attacker traverses the internal network unimpeded, exfiltrating sensitive database dumps and source code repositories.

Core Principle & Mechanism:
The Zero Trust model follows the mandate: "Never trust, always verify." Physical network location does not confer trust. Every service-to-service and user-to-service interaction must authenticate and authorize explicitly based on identity, device posture, and context. Under the Principle of Least Privilege (PoLP), identity and access management (IAM) policies grant only the absolute minimum permissions required to perform a specific job, and session credentials expire within minutes rather than months.

Step-by-Step Practical Application:
To adopt Zero Trust in cloud environments (AWS, GCP, Azure): Step 1: Deprecate static, long-lived API secret keys in favor of short-lived IAM roles and OpenID Connect (OIDC) identity providers. Step 2: Enforce granular resource scoping (e.g., granting read access strictly to s3://my-bucket/reports/ rather than s3:*). Step 3: Isolate production databases within private subnets with zero public IP addresses, accessing them exclusively through identity-aware proxies. Step 4: Enable detailed audit logging across all cloud API events.

Actionable Competency & Next Steps:
Zero Trust architecture is the industry standard for modern enterprise cloud engineering. Mastering IAM policy authoring and identity-aware proxies prepares you for cloud architect and DevSecOps engineering roles.`,
    keyInsight: 'Eliminate long-lived API keys; use short-lived IAM roles and verify identity explicitly on every network request.',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Zero Trust identity-aware proxy routing across isolated cloud environments',
    suggestedCourseTitle: 'Cloud Security & Zero Trust Architecture',
    tags: ['Cloud', 'Zero Trust', 'DevSecOps'],
    readTime: '2 min',
  },
  {
    id: 'ma-sec-03',
    topic: 'Networking & IT Fundamentals',
    category: 'Cybersecurity & IT',
    headline: 'TCP/IP Handshake & DNS Resolution: Tracing the Life of a Network Packet',
    snippet:
      'When an API request hangs or a website fails to load, IT professionals must isolate whether the failure is in DNS resolution, TLS certificate negotiation, or TCP packet drops. Understanding the TCP 3-way handshake and DNS hierarchy allows rapid diagnostic troubleshooting.',
    fullContent: `Real-World Challenge & Context:
When an application goes down in production, panic often sets in. Junior engineers frequently restart servers at random, hoping the issue resolves. Without understanding the layers of internet networking, teams waste hours guessing whether an outage is caused by a registrar DNS misconfiguration, an expired SSL certificate, a firewall rule dropping SYN packets, or an overloaded application server.

Core Principle & Mechanism:
Internet communication is structured around the 4-layer TCP/IP protocol stack. Before any HTTP data is transmitted, the client resolves a domain name into an IP address via a hierarchical DNS lookup (Root -> TLD -> Authoritative Nameserver). Once the IP is resolved, the transport layer establishes a reliable connection using the TCP 3-Way Handshake (SYN -> SYN-ACK -> ACK) to negotiate sequence numbers and buffer sizes. For secure HTTPS traffic, the TLS handshake then exchanges cipher suites and verifies server identity via public-key certificates.

Step-by-Step Practical Application:
To diagnose connectivity issues methodically: First, run dig or nslookup to verify that DNS records return valid IP addresses and that TTLs have not cached stale routing. Second, use curl -v or openssl s_client to inspect SSL/TLS certificate validity and handshake latency. Third, use traceroute and ping to verify gateway reachability. Fourth, inspect packet dumps with tcpdump or Wireshark to detect TCP retransmissions and dropped packets.

Actionable Competency & Next Steps:
A solid grasp of networking fundamentals equips you to debug distributed microservices, configure reverse proxies like Nginx, and manage enterprise IT infrastructure with confidence.`,
    keyInsight: 'Methodical network troubleshooting isolates DNS resolution, TCP handshake latency, and TLS verification step-by-step.',
    imageUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Packet inspection and TCP/IP protocol routing analysis on enterprise networks',
    suggestedCourseTitle: 'Networking Fundamentals & Network Troubleshooting',
    tags: ['Networking', 'DNS', 'IT Infrastructure'],
    readTime: '2 min',
  },

  // ==========================================
  // CATEGORY 4: Software Development and Technology
  // ==========================================
  {
    id: 'ma-dev-01',
    topic: 'Python Automation',
    category: 'Software Development & Technology',
    headline: 'Python for Practical Automation: Eliminating Repetitive File & Data Tasks',
    snippet:
      'Manual report generation and CSV reformatting consume valuable work hours. With straightforward Python scripts utilizing pathlib, requests, and pandas, non-developers can automate file restructuring, web scraping, and scheduled report delivery in under 50 lines of code.',
    fullContent: `Real-World Challenge & Context:
Administrative staff, marketing coordinators, and project managers spend hours every week downloading regional sales CSVs, renaming files with dates, filtering out duplicate entries, and emailing summary reports to department leads. These repetitive chores are tedious, vulnerable to typographical mistakes, and take time away from high-leverage strategic work.

Core Principle & Mechanism:
Python's standard library and open-source ecosystem provide accessible, high-level abstractions for interacting with the operating system and internet APIs. The pathlib module provides cross-platform filesystem path manipulation; pandas enables vector-based tabular data cleaning and aggregation; and the requests library allows simple HTTP communication with external web services. Wrapping these routines in scheduled cron jobs or task schedulers turns manual workflows into autonomous scripts.

Step-by-Step Practical Application:
To automate daily data collation: Step 1: Use pathlib.Path().glob("*.csv") to dynamically iterate through all newly downloaded data files in a folder. Step 2: Load and concatenate them into a unified DataFrame with pd.concat([pd.read_csv(f) for f in files]). Step 3: Clean and transform the data with drop_duplicates() and groupby(). Step 4: Export a clean executive Excel workbook using to_excel() with automated formatting. Step 5: Schedule the script to run daily at 8:00 AM using OS task schedulers.

Actionable Competency & Next Steps:
Learning Python for automation creates an immediate competitive advantage in any professional workplace. It acts as the stepping stone to software engineering, backend web development, and applied machine learning.`,
    keyInsight: 'Using Python pathlib and pandas automates manual file collation and CSV cleanup in a fraction of human execution time.',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Python data processing scripts and scheduled file automation routines',
    suggestedCourseTitle: 'Practical Python Programming & Workflow Automation',
    tags: ['Python', 'Automation', 'Programming'],
    readTime: '2 min',
  },
  {
    id: 'ma-dev-02',
    topic: 'Full-Stack Web Development',
    category: 'Software Development & Technology',
    headline: 'REST APIs & Client-Server Architecture: Designing Predictable Web Applications',
    snippet:
      'Unstructured API endpoints lead to tangled frontend code and race conditions. Implementing RESTful design conventions—using semantic HTTP verbs, standardized status codes, and stateless request authorization—ensures web applications scale cleanly and reliably.',
    fullContent: `Real-World Challenge & Context:
When development teams start building web applications without clear architectural conventions, endpoints become chaotic: endpoints like /doUpdateUser?id=5 or /deleteCourseViaPost appear at random. Frontend components end up making conflicting network calls, caching stale responses, and failing silently when network requests drop or servers return ambiguous 200 OK errors with error bodies.

Core Principle & Mechanism:
Representational State Transfer (REST) provides an architectural framework for stateless communication over HTTP. Resources are identified by predictable plural nouns (e.g. /api/courses, /api/courses/42/lessons). Standard HTTP verbs define the operation: GET reads, POST creates, PUT/PATCH updates, and DELETE removes. Response codes communicate outcomes clearly: 200/201 for success, 400 for client validation errors, 401 for unauthenticated requests, 403 for unauthorized access, and 500 for server exceptions.

Step-by-Step Practical Application:
To build scalable RESTful services: Step 1: Model endpoints around domain entities rather than actions (e.g., DELETE /api/lessons/:id instead of POST /api/delete-lesson). Step 2: Use idempotent PUT for full replacements and PATCH for partial updates. Step 3: Implement Bearer token authorization headers rather than fragile URL parameters. Step 4: Structure JSON error responses uniformly (e.g., { "error": "Description", "code": "INVALID_INPUT" }) to simplify client-side error handling.

Actionable Competency & Next Steps:
Mastering RESTful conventions allows you to architect scalable web APIs, integrate third-party services, and build responsive frontend applications using modern frameworks like React and Next.js.`,
    keyInsight: 'Model API endpoints around nouns and semantic HTTP verbs with consistent JSON error structures for maintainable web apps.',
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Stateless client-server REST communication and JSON data serialization',
    suggestedCourseTitle: 'Full-Stack Web Development & API Architecture',
    tags: ['Web Dev', 'REST APIs', 'Software'],
    readTime: '2 min',
  },
  {
    id: 'ma-dev-03',
    topic: 'Software Testing & Quality',
    category: 'Software Development & Technology',
    headline: 'Automated Unit & Integration Testing: Shipping Code Without Fear of Regressions',
    snippet:
      'Relying on manual testing before each software release inevitably allows critical bugs into production. Structuring an automated testing pyramid—combining fast unit tests, integration checkpoints, and CI/CD quality gates—catches breaking changes before they reach users.',
    fullContent: `Real-World Challenge & Context:
As software codebases grow in complexity, adding a new feature in one module frequently breaks an existing feature in an unrelated module. When development teams lack automated tests, engineers become terrified of refactoring legacy code. Releases slow to a crawl, and end-users encounter broken checkout flows, login failures, and data loss in production.

Core Principle & Mechanism:
The Test Pyramid framework balances test fidelity with execution velocity. Unit tests verify individual functions in isolation (such as currency conversion or date math) in milliseconds. Integration tests verify interactions between components, such as database queries and API controllers. Finally, End-to-End (E2E) tests verify critical user workflows in a headless browser. Automating these test suites within a Continuous Integration (CI) pipeline blocks pull requests that cause regressions.

Step-by-Step Practical Application:
To implement reliable automated testing: Step 1: Write pure, testable functions with minimal side effects. Step 2: Use modern testing runners (such as Vitest or Jest) to test boundary conditions and edge cases (e.g. empty inputs, negative numbers, null values). Step 3: Use integration tests with in-memory databases to verify CRUD endpoints. Step 4: Configure GitHub Actions or GitLab CI to run the test suite on every branch push, making passing tests a required merge condition.

Actionable Competency & Next Steps:
Understanding automated test patterns enables you to write robust, maintainable code that scales safely. This skill is universally required for mid-level and senior software engineering roles.`,
    keyInsight: 'An automated testing pyramid in CI/CD pipelines catches regressions before code ever deploys to production.',
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Automated CI/CD pipeline execution with unit and integration test suites',
    suggestedCourseTitle: 'Software Testing, Debugging & CI/CD Pipelines',
    tags: ['Testing', 'Software Quality', 'CI/CD'],
    readTime: '2 min',
  },

  // ==========================================
  // CATEGORY 5: Design, UX and Creativity
  // ==========================================
  {
    id: 'ma-des-01',
    topic: 'UI/UX Design Systems',
    category: 'Design, UX & Creativity',
    headline: 'The 8pt Grid & Visual Hierarchy: Transforming Cluttered Screens into Production UI',
    snippet:
      'Inconsistent spacing, arbitrary font sizes, and container box overload tax user working memory and make digital software look amateurish. The 8pt grid system and typographic scales establish systematic spatial rhythm and clear visual hierarchy that streamline engineering implementation.',
    fullContent: `Real-World Challenge & Context:
Amateur software designers and frontend engineers often attempt to organize dense information by wrapping every data point in nested background boxes, colored borders, and heavy divider lines. The resulting interfaces look cluttered, feel claustrophobic, and force users to expend mental energy decoding visual noise rather than completing their tasks. Arbitrary spacing values (such as 7px here and 19px there) also create friction during development and break responsive layouts.

Core Principle & Mechanism:
Professional product design is governed by systematic spatial rhythm and typographic hierarchy. The 8-Point Grid system dictates that all interface dimensions, padding, and margins are multiples of 8 (8, 16, 24, 32, 48, 64px), with a 4pt sub-grid for tight icon alignments. Because screen resolutions are divisible by 8, an 8pt system prevents subpixel rendering blur. When paired with Gestalt Proximity—the psychological law that objects positioned close together are instinctively perceived as related—calibrated whitespace replaces borders, allowing negative space to communicate grouping effortlessly.

Step-by-Step Practical Application:
To transform an interface: Step 1: Strip away all non-essential borders and nested container boxes. Step 2: Enforce strict 8pt spacing tokens—use 8px between closely related text elements, 16px between distinct card controls, and 24-32px between major structural sections. Step 3: Establish a modular typographic scale (e.g., 12px caption, 14px body, 18px subhead, 24px title) and enforce a strict 3-tier visual hierarchy: primary focal point (high contrast), secondary context (medium contrast), and tertiary metadata (muted contrast).

Actionable Competency & Next Steps:
Mastering spatial design systems enables developers and designers to build cohesive design systems, accelerate development velocity, and deliver effortless user experiences across web and mobile platforms.`,
    keyInsight: 'Using systematic 8-point spatial multiples and calibrated typographic hierarchy communicates structure without visual clutter.',
    imageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Systematic 8-point spatial tokens and modular typography in digital design systems',
    suggestedCourseTitle: 'Product Design Systems & UI Architecture',
    tags: ['Design', 'UI/UX', 'Frontend'],
    readTime: '2 min',
  },
  {
    id: 'ma-des-02',
    topic: 'User Research & Usability Testing',
    category: 'Design, UX & Creativity',
    headline: 'Usability Testing Protocols: Uncovering Product Friction Before Writing Code',
    snippet:
      'Asking users "Do you like this feature?" produces polite, misleading validation that masks critical usability flaws. Conducting structured, task-based usability testing reveals where users get confused, hesitate, or fail to achieve their goals.',
    fullContent: `Real-World Challenge & Context:
Product teams frequently spend months designing and engineering a feature, only to find that real users abandon the workflow halfway through. When teams ask users for opinions in surveys or focus groups, participants provide polite praise that contradicts their actual behavior. Building products based on stated opinions rather than observed behavior leads to expensive redesigns and failed launches.

Core Principle & Mechanism:
Usability testing evaluates a product by observing real users attempting to complete representative tasks. Jakob Nielsen's research demonstrates that testing with just 5 representative users uncovers over 80% of usability usability friction points. The core rule of usability research is: watch what users do, not what they say. Facilitators use the "Think-Aloud" protocol, prompting participants to verbalize their thought process while navigating without offering hints or corrections.

Step-by-Step Practical Application:
To execute a high-yield usability test: Step 1: Formulate 3 to 5 scenario-based tasks (e.g., "Find a beginner data analysis course and enroll using your email"). Step 2: Recruit 5 users who match your target audience profile. Step 3: Instruct the user to think aloud and observe where they click, where their mouse pauses, and where they make wrong turns. Step 4: Avoid leading questions; if the user asks for help, respond neutrally: "What would you expect to happen here?" Step 5: Document error frequency and task completion rates to prioritize design fixes.

Actionable Competency & Next Steps:
Conducting structured usability testing ensures that every digital feature solves real user problems effectively. This competency is essential for UX researchers, product managers, and startup founders.`,
    keyInsight: 'Test with 5 users using task-based think-aloud protocols to discover 80% of usability friction points before launch.',
    imageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Task-based usability observation and user experience research protocols',
    suggestedCourseTitle: 'User Research & Usability Testing in Practice',
    tags: ['UX Research', 'Usability', 'Product Management'],
    readTime: '2 min',
  },

  // ==========================================
  // CATEGORY 6: Content Creation and Digital Media
  // ==========================================
  {
    id: 'ma-media-01',
    topic: 'Digital Video Storytelling',
    category: 'Content Creation & Digital Media',
    headline: 'The 3-Second Hook & Retention Curve: Structuring High-Yield Educational Video',
    snippet:
      'Online video viewers drop off exponentially within the first five seconds of slow introductions or logos. Structuring videos around immediate curiosity hooks, pacing cuts, and clear visual payoff curves maximizes watch time and audience retention.',
    fullContent: `Real-World Challenge & Context:
Content creators, online educators, and corporate trainers often invest days filming high-quality videos, only to see 70% of viewers abandon the video within the first 10 seconds. Starting a video with animated logos, lengthy personal greetings, or generic introductions kills viewer curiosity before the valuable content even begins.

Core Principle & Mechanism:
Digital video platforms measure audience engagement through the Audience Retention Curve. Retention drops steepest at the beginning. Successful educational storytelling utilizes the Hook-Story-Payoff structure. The Hook (first 3-5 seconds) immediately establishes an unresolved question, counter-intuitive fact, or high-stakes problem without preamble. The Story maintains momentum through dynamic visual changes (B-roll, graphic callouts, J/L cut audio overlaps) every 4 to 7 seconds. The Payoff delivers a practical, memorable insight before leading into a clear call to action.

Step-by-Step Practical Application:
To optimize educational video content: Step 1: Eliminate introductory logos and greetings; start immediately with the core problem statement or unexpected outcome. Step 2: Write an explicit script outline targeting a 150-words-per-minute pacing. Step 3: Use J-cuts (audio starts before the visual cut) and L-cuts (audio continues after the visual cut) to create seamless transitions. Step 4: Add bold on-screen kinetic captions for key vocabulary words to support sound-off viewing. Step 5: Audit YouTube or TikTok retention analytics to pinpoint exact timestamps where drop-offs occur and adjust pacing accordingly.

Actionable Competency & Next Steps:
Mastering digital video structure empowers you to teach complex skills online, produce compelling marketing videos, and build an engaged digital audience across platforms.`,
    keyInsight: 'Hook viewers in the first 3 seconds with the core problem; maintain pacing with audio J-cuts and visual changes every 5 seconds.',
    imageUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Timeline pacing and multi-track audio transition editing for digital media',
    suggestedCourseTitle: 'Digital Video Production & Storytelling Architecture',
    tags: ['Video Editing', 'Content Creation', 'Storytelling'],
    readTime: '2 min',
  },
  {
    id: 'ma-media-02',
    topic: 'Content Strategy & SEO',
    category: 'Content Creation & Digital Media',
    headline: 'Topic Clusters & Search Intent: Building an Authoritative Digital Content Engine',
    snippet:
      'Publishing disconnected blog posts or social updates produces sporadic traffic that vanishes overnight. Organizing content into structured Topic Clusters around specific search intent establishes topical authority that compounds organic reach over years.',
    fullContent: `Real-World Challenge & Context:
Businesses and independent creators often write dozens of articles on random, disjointed topics hoping for viral traffic. When traffic spikes fade, visitor numbers collapse back to zero. Without a strategic content architecture aligned with search engine algorithms and user intent, content production becomes an exhausting, low-return treadmill.

Core Principle & Mechanism:
Search engines and content recommendation algorithms evaluate topical authority rather than isolated keywords. The Topic Cluster model pairs a comprehensive "Pillar Page" (covering a broad domain thoroughly) with tightly focused "Cluster Articles" addressing specific sub-topics, all interconnected with reciprocal hyperlinks. Search intent is categorized into Informational ("how to do X"), Commercial ("best tools for X"), or Transactional ("buy X"). Aligning content format with exact intent signals authority to ranking algorithms.

Step-by-Step Practical Application:
To build an authoritative topic cluster: Step 1: Select a core pillar topic (e.g. "Data Analysis for Marketing"). Step 2: Research 8 to 12 long-tail sub-topics answering specific practitioner questions (e.g. "How to calculate customer churn in SQL", "Cohort retention formulas"). Step 3: Author comprehensive, high-utility guides for each sub-topic with clear diagrams and code snippets. Step 4: Link all cluster posts back to the central pillar page with descriptive anchor text. Step 5: Repurpose core insights into LinkedIn carousels, short videos, and newsletter issues.

Actionable Competency & Next Steps:
Developing strategic content engines allows businesses and creators to generate steady inbound leads and establish trusted thought leadership in their industry.`,
    keyInsight: 'Interlinking dedicated cluster articles to an authoritative pillar page signals deep topical authority to search engines.',
    imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Search intent mapping and topic cluster architecture for organic content growth',
    suggestedCourseTitle: 'Content Strategy, SEO & Audience Development',
    tags: ['Content Strategy', 'SEO', 'Digital Marketing'],
    readTime: '2 min',
  },
  {
    id: 'ma-media-03',
    topic: 'Technical Writing & Documentation',
    category: 'Content Creation & Digital Media',
    headline: 'Frictionless Technical Writing: Authoring Clear Documentation and User Guides',
    snippet:
      'Ambiguous technical instructions, missing prerequisites, and walls of dense jargon frustrate developers and end-users. Applying structured documentation standards—with clear prerequisites, copyable code blocks, and visual step indicators—minimizes support overhead and accelerates onboarding.',
    fullContent: `Real-World Challenge & Context:
Software libraries, internal company wikis, and product onboarding manuals are notorious for being out-of-date, confusing, and disorganized. When documentation fails, developers spend days struggling with broken setup steps, customers bombard support teams with basic setup questions, and open-source projects fail to attract contributors.

Core Principle & Mechanism:
High-quality technical documentation is structured around the Diátaxis Framework, which separates content into four distinct modes: Tutorials (learning-oriented lessons for beginners), How-To Guides (goal-oriented recipes solving specific problems), Reference Guides (information-oriented technical specifications), and Explanation (understanding-oriented conceptual deep-dives). Mixing these modes creates confusion; maintaining clear separation ensures readers find exactly what they need based on their current goal.

Step-by-Step Practical Application:
To author clear technical guides: Step 1: Always list prerequisites and version dependencies explicitly at the top of the guide. Step 2: Provide complete, runnable code or command snippets with an easily clickable "Copy" button. Step 3: Use active voice and imperative verbs (e.g., "Install the package" rather than "The package should now be installed"). Step 4: Include screenshots or expected terminal outputs immediately following each command so readers can verify success. Step 5: Test instructions on a clean, fresh environment to verify that no hidden dependencies were omitted.

Actionable Competency & Next Steps:
Mastering technical communication is a high-leverage skill that distinguishes top software engineers, technical writers, and product managers. It directly reduces customer churn and engineering support costs.`,
    keyInsight: 'Separate documentation into tutorials, how-to recipes, and technical references to provide frictionless user guidance.',
    imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80',
    imageCaption: 'Structured technical documentation and developer onboarding reference guides',
    suggestedCourseTitle: 'Technical Writing, Documentation & Communication',
    tags: ['Technical Writing', 'Documentation', 'Communication'],
    readTime: '2 min',
  },
];

export class MicroArticleService {
  /**
   * Retrieves high-yield practical micro-articles matching user interests
   * or a balanced representation across the 6 core categories.
   */
  public async getArticlesForInterests(userInterests: string[] = []): Promise<MicroArticle[]> {
    const cleanInterests = (userInterests || [])
      .map((i) => (typeof i === 'string' ? i.trim() : ''))
      .filter((i) => i.length > 0);

    // 1. Filter curated articles by interest if provided
    let matchedCurated = [...CURATED_MICRO_ARTICLES];
    if (cleanInterests.length > 0) {
      const filtered = CURATED_MICRO_ARTICLES.filter((a) => {
        const text = `${a.topic} ${a.category} ${a.tags.join(' ')}`.toLowerCase();
        return cleanInterests.some((interest) =>
          text.includes(interest.toLowerCase())
        );
      });
      if (filtered.length > 0) {
        matchedCurated = [
          ...filtered,
          ...CURATED_MICRO_ARTICLES.filter((a) => !filtered.includes(a)),
        ];
      }
    }

    // 2. Attempt dynamic AI generation if Gemini is available and interests are provided
    if (process.env.GEMINI_API_KEY && cleanInterests.length > 0) {
      try {
        const aiGenerated = await this.generateWithGemini(cleanInterests.slice(0, 3));
        if (aiGenerated && aiGenerated.length > 0) {
          // Prepend AI generated articles to matched curated items
          return [...aiGenerated, ...matchedCurated].slice(0, 16);
        }
      } catch (err) {
        console.warn('[MicroArticleService] Dynamic generation failed, serving curated pool:', err);
      }
    }

    // Return balanced mix of curated practical articles
    return [...matchedCurated];
  }

  private async generateWithGemini(targetInterests: string[]): Promise<MicroArticle[]> {
    const prompt = `You are Mindly's Lead Curriculum Architect and Practical Knowledge Engine.
The user is interested in developing skills and capabilities in these disciplines: ${targetInterests.join(', ')}.

Generate 2 distinct, highly practical, high-yield educational micro-articles strictly adhering to Mindly's 6 core practical categories:
1. Artificial Intelligence and Automation
2. Data Analysis and Digital Literacy
3. Cybersecurity and IT
4. Software Development and Technology
5. Design, UX and Creativity
6. Content Creation and Digital Media

CRITICAL STANDARD:
Every generated topic must pass this test:
"What meaningful knowledge, skill, understanding, or capability will the user gain from learning this in employment, entrepreneurship, professional development, or everyday problem-solving?"

Prioritize topics that:
1. Teach a practical skill or repeatable technique.
2. Explain a foundational concept needed to master advanced subjects.
3. Help solve a real-world problem or operational challenge.
4. Improve career readiness or technical competence.

STRICTLY AVOID:
- Obscure documentary-style curiosities or passive trivia with zero real-world application (e.g. do NOT generate random celestial curiosities like Roche limits or obscure historical trivia).
- Every topic MUST be directly actionable, practical, or structurally foundational.

Requirements:
1. "headline": A sharp, practical, outcome-oriented title.
2. "snippet": Exactly 2 to 3 sentences explaining the practical problem and core technique.
3. "keyInsight": A one-line actionable takeaway or rule of thumb that the learner can remember and apply.
4. "fullContent": A comprehensive, high-yield educational walkthrough of AT LEAST 240 WORDS divided into 4 clearly subtitled sections:
   - "Real-World Challenge & Context:" (Explain the friction, problem, or inefficiency encountered in practice)
   - "Core Principle & Mechanism:" (Explain the underlying math, science, or logic clearly)
   - "Step-by-Step Practical Application:" (Provide a concrete technique, protocol, or implementation steps)
   - "Actionable Competency & Next Steps:" (Explain what capability the user has gained and what full course to pursue next)
5. "suggestedCourseTitle": A clean 3-5 word course title suitable for immediate enrollment.
6. "topic": Specific skill or concept name.
7. "category": Must be one of:
   - "Artificial Intelligence & Automation"
   - "Data Analysis & Digital Literacy"
   - "Cybersecurity & IT"
   - "Software Development & Technology"
   - "Design, UX & Creativity"
   - "Content Creation & Digital Media"
8. "imageSearchTerm": A precise 2-word concrete physical or technical subject (e.g. "Robotic Arm", "Database Server", "Circuit Board", "Code Screen", "Dashboard Chart").
9. "tags": Array of 3 relevant practical skills or domain keywords.

Respond with ONLY a JSON array matching this exact schema:
[
  {
    "id": "ma-gen-1",
    "topic": "${targetInterests[0] || 'AI Tools'}",
    "category": "Artificial Intelligence & Automation",
    "headline": "Headline Here",
    "snippet": "Sentence 1. Sentence 2. Sentence 3.",
    "fullContent": "Real-World Challenge & Context:\\nParagraph 1 (at least 60 words)...\\n\\nCore Principle & Mechanism:\\nParagraph 2 (at least 60 words)...\\n\\nStep-by-Step Practical Application:\\nParagraph 3 (at least 60 words)...\\n\\nActionable Competency & Next Steps:\\nParagraph 4 (at least 60 words)...",
    "keyInsight": "One line practical rule of thumb",
    "suggestedCourseTitle": "Course Name",
    "imageSearchTerm": "Concrete Subject",
    "tags": ["Skill1", "Skill2", "Domain"]
  }
]`;

    const aiResult = await callGeminiWithRetry(async (modelName) => {
      const apiKey = process.env.GEMINI_API_KEY!;
      const client = new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.5,
        },
      });

      const text = response.text || '';
      return JSON.parse(text);
    });

    if (!Array.isArray(aiResult)) return [];

    const enriched: MicroArticle[] = [];
    for (const item of aiResult) {
      if (!item.headline || !item.snippet) continue;

      let imageUrl: string | undefined;
      let imageCaption: string | undefined;

      if (item.imageSearchTerm) {
        try {
          const imgs = await searchWikimediaImages(item.imageSearchTerm, 1);
          if (imgs.length > 0 && imgs[0].url) {
            imageUrl = cleanImageUrl(imgs[0].url);
            const rawCap = imgs[0].caption || '';
            if (
              !/cropped from file:/i.test(rawCap) &&
              !/^file:/i.test(rawCap) &&
              !/\.(svg|png|jpg)$/i.test(rawCap)
            ) {
              imageCaption = rawCap;
            }
          }
        } catch {
          // ignore
        }
      }

      if (!imageUrl) {
        imageUrl = getStockFallback(item.topic || targetInterests[0], item.category);
      }

      enriched.push({
        id: `ma-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        topic: item.topic || targetInterests[0],
        category: item.category || 'Artificial Intelligence & Automation',
        headline: item.headline,
        snippet: item.snippet,
        fullContent: item.fullContent || `${item.snippet}\n\n${item.keyInsight || ''}`,
        keyInsight: item.keyInsight,
        imageUrl,
        imageCaption,
        suggestedCourseTitle:
          item.suggestedCourseTitle || `${item.topic} Practical Foundations`,
        tags: Array.isArray(item.tags) ? item.tags : [item.topic],
        readTime: '2 min',
      });
    }

    return enriched;
  }
}

export const microArticleService = new MicroArticleService();
