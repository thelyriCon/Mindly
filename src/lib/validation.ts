/**
 * Mindly Deterministic Lesson Quality & Schema Validator
 * 
 * Performs rigorous, non-AI deterministic verification of authored educational lessons.
 * Ensures:
 * 1. Complete StructuredContent schema presence (all sections populated)
 * 2. Academic substance & thorough explanations (enforcing minimum character depths)
 * 3. Elimination of hardcoded boilerplate and placeholder patterns
 * 4. Non-circular, non-tautological glossary definitions
 * 5. Robust quiz mechanics (4 distinct options, verified answer key, educational explanations)
 * 6. Content originality across sections (no duplicated paragraphs or copied overviews)
 */

import {
  StructuredContent,
  LessonConcept,
  LessonExample,
  ImportantDistinction,
  KeyTermItem,
  ReviewQuestion,
} from '../types';

export interface LessonValidationChecklist {
  hasRequiredFields: boolean;
  substantiveExplanations: boolean;
  noPlaceholders: boolean;
  noCircularDefinitions: boolean;
  quizConsistency: boolean;
  noDuplicateContent: boolean;
  hasValidDiagrams: boolean;
}

export interface LessonValidationResult {
  valid: boolean;
  reason?: string;
  errors?: string[];
  checks: LessonValidationChecklist;
}

export interface ValidateLessonOptions {
  minObjectives?: number;
  minConcepts?: number;
  minExamples?: number;
  minDistinctions?: number;
  minKeyTerms?: number;
  minTakeaways?: number;
  minQuestions?: number;
  minDiagrams?: number;
  minOverviewLength?: number;
  minConceptExplanationLength?: number;
  minSubtopicExplanationLength?: number;
  minExampleDescriptionLength?: number;
  minDistinctionLength?: number;
  minTermDefinitionLength?: number;
  minQuizExplanationLength?: number;
}

/**
 * Patterns of known legacy generator templates, generic fillers, and boilerplate skeletons.
 * Any occurrence triggers validation failure.
 */
export const KNOWN_PLACEHOLDER_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'foundational explanation template', pattern: /foundational explanation of/i },
  { name: 'theoretical mechanics template', pattern: /key theoretical and practical mechanics/i },
  { name: 'illustrative application template', pattern: /concrete illustrative application/i },
  { name: 'solid understanding template', pattern: /solid understanding of .* mechanics/i },
  { name: 'primary concept template', pattern: /primary concept in/i },
  { name: 'essential concepts template', pattern: /essential concepts and principles for/i },
  { name: 'operational boundaries template', pattern: /understanding the operational boundaries prevents superficial assumptions/i },
  { name: 'mastery of curriculum template', pattern: /demonstrated mastery of curriculum standards/i },
  { name: 'core mechanisms template', pattern: /to understand the core mechanisms and practical applications of/i },
  { name: 'detailed examination template', pattern: /detailed examination of .* within the scope of/i },
  { name: 'lorem ipsum text', pattern: /lorem ipsum/i },
  { name: 'placeholder token', pattern: /\[(?:concept|topic|lesson|course|title|placeholder|insert .*?)\]/i },
  { name: 'explicit placeholder phrase', pattern: /\b(insert (?:explanation|text|concept|content) here)\b/i },
  { name: 'generic sample placeholder', pattern: /\b(sample explanation|sample text|placeholder text)\b/i },
  { name: 'todo or tbd annotation', pattern: /\b(TODO:|TBD:|FIXME:)\b/i },
];

/**
 * Deterministically validates an educational lesson against all pedagogical and structural criteria.
 *
 * @param content The structured lesson content to validate
 * @param options Optional overrides for minimum thresholds
 * @returns LessonValidationResult with detailed breakdown of all checks
 */
export function validateLessonContent(
  content: StructuredContent,
  options?: ValidateLessonOptions
): LessonValidationResult {
  const errors: string[] = [];

  const checks: LessonValidationChecklist = {
    hasRequiredFields: false,
    substantiveExplanations: false,
    noPlaceholders: false,
    noCircularDefinitions: false,
    quizConsistency: false,
    noDuplicateContent: false,
    hasValidDiagrams: false,
  };

  // Thresholds
  const minObjectives = options?.minObjectives ?? 2;
  const minConcepts = options?.minConcepts ?? 2;
  const minExamples = options?.minExamples ?? 1;
  const minDistinctions = options?.minDistinctions ?? 1;
  const minKeyTerms = options?.minKeyTerms ?? 2;
  const minTakeaways = options?.minTakeaways ?? 2;
  const minQuestions = options?.minQuestions ?? 2;
  const minDiagrams = options?.minDiagrams ?? 1;

  const minOverviewLen = options?.minOverviewLength ?? 250;
  const minConceptExpLen = options?.minConceptExplanationLength ?? 250;
  const minSubtopicExpLen = options?.minSubtopicExplanationLength ?? 60;
  const minExampleDescLen = options?.minExampleDescriptionLength ?? 100;
  const minDistinctionLen = options?.minDistinctionLength ?? 45;
  const minTermDefLen = options?.minTermDefinitionLength ?? 25;
  const minQuizExpLen = options?.minQuizExplanationLength ?? 25;

  // -------------------------------------------------------------
  // 1. Required Fields & Array Cardinality Verification
  // -------------------------------------------------------------
  if (!content || typeof content !== 'object') {
    return {
      valid: false,
      reason: 'Lesson content must be a valid non-null object.',
      errors: ['Lesson content is null, undefined, or not an object.'],
      checks,
    };
  }

  if (!content.title || typeof content.title !== 'string' || content.title.trim().length < 3) {
    errors.push('Lesson title is missing or too short (minimum 3 characters).');
  }

  if (!content.overview || typeof content.overview !== 'string' || content.overview.trim().length === 0) {
    errors.push('Lesson overview is missing or empty.');
  }

  if (!Array.isArray(content.learningObjectives) || content.learningObjectives.length < minObjectives) {
    errors.push(`Learning objectives must contain at least ${minObjectives} clear items.`);
  } else {
    for (let i = 0; i < content.learningObjectives.length; i++) {
      const obj = content.learningObjectives[i];
      if (!obj || typeof obj !== 'string' || obj.trim().length < 12) {
        errors.push(`Learning objective ${i + 1} is too brief or invalid (minimum 12 characters).`);
      }
    }
  }

  if (!Array.isArray(content.mainConcepts) || content.mainConcepts.length < minConcepts) {
    errors.push(`Main concepts must contain at least ${minConcepts} core conceptual modules.`);
  }

  if (!Array.isArray(content.examples) || content.examples.length < minExamples) {
    errors.push(`Lesson must contain at least ${minExamples} concrete example(s).`);
  }

  if (!Array.isArray(content.importantDistinctions) || content.importantDistinctions.length < minDistinctions) {
    errors.push(`Important distinctions must contain at least ${minDistinctions} conceptual contrast(s).`);
  }

  if (!Array.isArray(content.keyTerms) || content.keyTerms.length < minKeyTerms) {
    errors.push(`Key terms glossary must contain at least ${minKeyTerms} defined term(s).`);
  }

  if (!Array.isArray(content.keyTakeaways) || content.keyTakeaways.length < minTakeaways) {
    errors.push(`Key takeaways must contain at least ${minTakeaways} core principle(s).`);
  } else {
    for (let i = 0; i < content.keyTakeaways.length; i++) {
      const takeaway = content.keyTakeaways[i];
      if (!takeaway || typeof takeaway !== 'string' || takeaway.trim().length < 15) {
        errors.push(`Key takeaway ${i + 1} is too brief or invalid (minimum 15 characters).`);
      }
    }
  }

  if (!Array.isArray(content.reviewQuestions) || content.reviewQuestions.length < minQuestions) {
    errors.push(`Review questions must contain at least ${minQuestions} questions.`);
  }

  // Diagrams (Visual Mermaid.js) Verification
  let diagramValid = false;
  if (!Array.isArray(content.diagrams) || content.diagrams.length < minDiagrams) {
    errors.push(`Lesson must contain at least ${minDiagrams} visual Mermaid.js diagram(s).`);
  } else {
    let allDiagramsPass = true;
    for (let i = 0; i < content.diagrams.length; i++) {
      const diag = content.diagrams[i];
      if (!diag || typeof diag !== 'object') {
        errors.push(`Diagram ${i + 1} must be an object with title, caption, and mermaidCode.`);
        allDiagramsPass = false;
        continue;
      }
      if (!diag.title || typeof diag.title !== 'string' || diag.title.trim().length < 3) {
        errors.push(`Diagram ${i + 1} is missing a descriptive title (minimum 3 characters).`);
        allDiagramsPass = false;
      }
      if (!diag.caption || typeof diag.caption !== 'string' || diag.caption.trim().length < 15) {
        errors.push(`Diagram ${i + 1} is missing a pedagogical caption (minimum 15 characters).`);
        allDiagramsPass = false;
      }
      if (!diag.mermaidCode || typeof diag.mermaidCode !== 'string' || diag.mermaidCode.trim().length < 15) {
        errors.push(`Diagram ${i + 1} is missing valid Mermaid.js code (minimum 15 characters).`);
        allDiagramsPass = false;
      } else {
        let cleanMermaid = diag.mermaidCode.trim();
        cleanMermaid = cleanMermaid.replace(/^```(?:mermaid)?\n?/, '').replace(/\n?```$/, '').trim();
        // Quote any unquoted labels containing parentheses: [Foo (Bar)] -> ["Foo (Bar)"]
        cleanMermaid = cleanMermaid.replace(/\[([^[\]"\n]*\([^[\]"\n]*\)[^[\]"\n]*)\]/g, '["$1"]');
        diag.mermaidCode = cleanMermaid;

        const hasValidKeyword =
          /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|pie|gitGraph|journey|timeline|mindmap|quadrantChart)\b/i.test(
            cleanMermaid
          ) ||
          cleanMermaid.includes('-->') ||
          cleanMermaid.includes('->');
        if (!hasValidKeyword) {
          errors.push(
            `Diagram ${i + 1} ("${diag.title || 'Untitled'}") must begin with valid Mermaid.js syntax (e.g. graph TD, flowchart LR, sequenceDiagram).`
          );
          allDiagramsPass = false;
        }
      }
    }
    if (allDiagramsPass) {
      diagramValid = true;
      checks.hasValidDiagrams = true;
    }
  }

  if (minDiagrams === 0 && !checks.hasValidDiagrams) {
    checks.hasValidDiagrams = true;
  }

  if (errors.length === 0) {
    checks.hasRequiredFields = true;
  }

  // -------------------------------------------------------------
  // 2. Substantive Content Length & Pedagogical Depth
  // -------------------------------------------------------------
  let substanceFailed = false;

  // Overview substantive check
  if (content.overview && content.overview.trim().length < minOverviewLen) {
    errors.push(
      `Lesson overview is too brief (${content.overview.trim().length} chars). Required: >= ${minOverviewLen} characters for thorough contextual foundation.`
    );
    substanceFailed = true;
  }

  // Main concepts depth
  if (Array.isArray(content.mainConcepts)) {
    content.mainConcepts.forEach((concept: LessonConcept, idx: number) => {
      if (!concept.title || concept.title.trim().length < 3) {
        errors.push(`Concept ${idx + 1} is missing a descriptive title.`);
        substanceFailed = true;
      }
      if (!concept.explanation || concept.explanation.trim().length < minConceptExpLen) {
        errors.push(
          `Concept "${concept.title || idx + 1}" explanation is too brief (${concept.explanation ? concept.explanation.trim().length : 0} chars). Required: >= ${minConceptExpLen} characters explaining underlying mechanisms.`
        );
        substanceFailed = true;
      }
      if (!Array.isArray(concept.subtopics) || concept.subtopics.length === 0) {
        errors.push(
          `Concept "${concept.title || idx + 1}" must have at least 1 subtopic breaking down practical mechanisms.`
        );
        substanceFailed = true;
      } else {
        concept.subtopics.forEach((sub, sIdx) => {
          if (!sub.title || sub.title.trim().length < 2) {
            errors.push(`Subtopic ${sIdx + 1} in concept "${concept.title || idx + 1}" has an empty title.`);
            substanceFailed = true;
          }
          if (!sub.explanation || sub.explanation.trim().length < minSubtopicExpLen) {
            errors.push(
              `Subtopic "${sub.title || sIdx + 1}" in concept "${concept.title || idx + 1}" is too brief (${sub.explanation ? sub.explanation.trim().length : 0} chars). Required: >= ${minSubtopicExpLen} chars.`
            );
            substanceFailed = true;
          }
        });
      }
    });
  }

  // Examples depth
  if (Array.isArray(content.examples)) {
    content.examples.forEach((ex: LessonExample, idx: number) => {
      if (!ex.title || ex.title.trim().length < 3) {
        errors.push(`Example ${idx + 1} title is missing or too brief.`);
        substanceFailed = true;
      }
      if (!ex.description || ex.description.trim().length < minExampleDescLen) {
        errors.push(
          `Example "${ex.title || idx + 1}" description is too brief (${ex.description ? ex.description.trim().length : 0} chars). Required: >= ${minExampleDescLen} chars providing a step-by-step practical scenario.`
        );
        substanceFailed = true;
      }
    });
  }

  // Distinctions depth
  if (Array.isArray(content.importantDistinctions)) {
    content.importantDistinctions.forEach((d: ImportantDistinction, idx: number) => {
      if (!d.conceptA || !d.conceptB || d.conceptA.trim().length < 2 || d.conceptB.trim().length < 2) {
        errors.push(`Distinction ${idx + 1} must specify two valid concept names to contrast.`);
        substanceFailed = true;
      }
      if (!d.distinction || d.distinction.trim().length < minDistinctionLen) {
        errors.push(
          `Distinction between "${d.conceptA}" and "${d.conceptB}" is too brief (${d.distinction ? d.distinction.trim().length : 0} chars). Required: >= ${minDistinctionLen} chars detailing the critical boundary.`
        );
        substanceFailed = true;
      }
    });
  }

  // Key terms depth
  if (Array.isArray(content.keyTerms)) {
    content.keyTerms.forEach((term: KeyTermItem, idx: number) => {
      if (!term.term || term.term.trim().length < 2) {
        errors.push(`Key term ${idx + 1} has an empty term name.`);
        substanceFailed = true;
      }
      if (!term.definition || term.definition.trim().length < minTermDefLen) {
        errors.push(
          `Key term "${term.term || idx + 1}" definition is too brief (${term.definition ? term.definition.trim().length : 0} chars). Required: >= ${minTermDefLen} chars providing formal academic meaning.`
        );
        substanceFailed = true;
      }
    });
  }

  if (!substanceFailed && checks.hasRequiredFields) {
    checks.substantiveExplanations = true;
  }

  // -------------------------------------------------------------
  // 3. Known Placeholder & Boilerplate String Detection
  // -------------------------------------------------------------
  const aggregatedTextSnippets: string[] = [];

  if (content.title) aggregatedTextSnippets.push(content.title);
  if (content.overview) aggregatedTextSnippets.push(content.overview);
  if (Array.isArray(content.learningObjectives)) aggregatedTextSnippets.push(...content.learningObjectives);

  if (Array.isArray(content.mainConcepts)) {
    content.mainConcepts.forEach((c) => {
      if (c.title) aggregatedTextSnippets.push(c.title);
      if (c.explanation) aggregatedTextSnippets.push(c.explanation);
      if (Array.isArray(c.subtopics)) {
        c.subtopics.forEach((s) => {
          if (s.title) aggregatedTextSnippets.push(s.title);
          if (s.explanation) aggregatedTextSnippets.push(s.explanation);
        });
      }
    });
  }

  if (Array.isArray(content.examples)) {
    content.examples.forEach((e) => {
      if (e.title) aggregatedTextSnippets.push(e.title);
      if (e.description) aggregatedTextSnippets.push(e.description);
    });
  }

  if (Array.isArray(content.importantDistinctions)) {
    content.importantDistinctions.forEach((d) => {
      if (d.conceptA) aggregatedTextSnippets.push(d.conceptA);
      if (d.conceptB) aggregatedTextSnippets.push(d.conceptB);
      if (d.distinction) aggregatedTextSnippets.push(d.distinction);
    });
  }

  if (Array.isArray(content.keyTerms)) {
    content.keyTerms.forEach((k) => {
      if (k.term) aggregatedTextSnippets.push(k.term);
      if (k.definition) aggregatedTextSnippets.push(k.definition);
      if (k.context) aggregatedTextSnippets.push(k.context);
    });
  }

  if (Array.isArray(content.keyTakeaways)) aggregatedTextSnippets.push(...content.keyTakeaways);

  if (Array.isArray(content.diagrams)) {
    content.diagrams.forEach((d) => {
      if (d && typeof d === 'object') {
        if (d.title) aggregatedTextSnippets.push(d.title);
        if (d.caption) aggregatedTextSnippets.push(d.caption);
      }
    });
  }

  if (Array.isArray(content.reviewQuestions)) {
    content.reviewQuestions.forEach((q) => {
      if (q.question) aggregatedTextSnippets.push(q.question);
      if (q.explanation) aggregatedTextSnippets.push(q.explanation);
      if (Array.isArray(q.options)) aggregatedTextSnippets.push(...q.options);
    });
  }

  const entireCorpus = aggregatedTextSnippets.join('\n');
  let placeholderDetected = false;

  for (const item of KNOWN_PLACEHOLDER_PATTERNS) {
    if (item.pattern.test(entireCorpus)) {
      errors.push(`Content contains banned template boilerplate matching ${item.name} (${item.pattern}).`);
      placeholderDetected = true;
    }
  }

  if (!placeholderDetected) {
    checks.noPlaceholders = true;
  }

  // -------------------------------------------------------------
  // 4. Circular & Tautological Glossary Definitions
  // -------------------------------------------------------------
  let circularDetected = false;

  if (Array.isArray(content.keyTerms)) {
    for (const item of content.keyTerms) {
      if (!item.term || !item.definition) continue;
      const cleanTerm = item.term.trim().toLowerCase();
      const cleanDef = item.definition.trim().toLowerCase();

      // Literal term repetition
      if (cleanDef === cleanTerm || cleanDef === `the ${cleanTerm}` || cleanDef === `a ${cleanTerm}`) {
        errors.push(`Key term "${item.term}" has a circular definition identical to its name.`);
        circularDetected = true;
      }

      // Tautological prefix check
      if (
        cleanDef.startsWith(`the condition of being ${cleanTerm}`) ||
        cleanDef.startsWith(`the state of being ${cleanTerm}`) ||
        cleanDef.startsWith(`the process of ${cleanTerm}`) ||
        cleanDef.startsWith(`the act of ${cleanTerm}`) ||
        cleanDef.startsWith(`defined as ${cleanTerm}`)
      ) {
        errors.push(
          `Key term "${item.term}" has a tautological or uninformative definition ("${item.definition}").`
        );
        circularDetected = true;
      }
    }
  }

  if (!circularDetected) {
    checks.noCircularDefinitions = true;
  }

  // -------------------------------------------------------------
  // 5. Quiz Structure & Answer Consistency (4 Options, Verified Key)
  // -------------------------------------------------------------
  let quizFailed = false;

  if (Array.isArray(content.reviewQuestions)) {
    content.reviewQuestions.forEach((q: ReviewQuestion, idx: number) => {
      const qNum = idx + 1;

      // Question length
      if (!q.question || q.question.trim().length < 15) {
        errors.push(`Review question ${qNum} is missing or too short (< 15 characters).`);
        quizFailed = true;
      }

      // Must have exactly 4 multiple choice options
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        errors.push(
          `Review question ${qNum} ("${q.question || 'Untitled'}") must have exactly 4 options. Found: ${
            Array.isArray(q.options) ? q.options.length : 0
          }.`
        );
        quizFailed = true;
      } else {
        // Options must be non-empty and unique
        const trimmedOptions = q.options.map((opt) => (opt ? opt.trim() : ''));
        const emptyOptIndex = trimmedOptions.findIndex((opt) => opt.length === 0);
        if (emptyOptIndex !== -1) {
          errors.push(`Review question ${qNum} option ${emptyOptIndex + 1} is empty.`);
          quizFailed = true;
        }

        const uniqueOptions = new Set(trimmedOptions.map((opt) => opt.toLowerCase()));
        if (uniqueOptions.size !== q.options.length) {
          errors.push(`Review question ${qNum} has duplicate answer options.`);
          quizFailed = true;
        }

        // Answer must match one of the 4 options
        if (!q.answer || !q.answer.trim()) {
          errors.push(`Review question ${qNum} is missing an answer key.`);
          quizFailed = true;
        } else {
          const cleanAnswer = q.answer.trim();
          const matchIndex = trimmedOptions.findIndex(
            (opt) => opt === cleanAnswer || opt.toLowerCase() === cleanAnswer.toLowerCase()
          );
          if (matchIndex === -1) {
            errors.push(
              `Review question ${qNum} answer "${cleanAnswer}" does not match any of the 4 provided options: [${trimmedOptions.join(
                ' | '
              )}].`
            );
            quizFailed = true;
          } else {
            if ((q as any).correctIndex !== undefined) {
              const ci = Number((q as any).correctIndex);
              if (isNaN(ci) || ci < 0 || ci > 3) {
                errors.push(`Review question ${qNum} has an invalid correctIndex: ${ci} (must be between 0 and 3).`);
                quizFailed = true;
              }
            } else {
              (q as any).correctIndex = matchIndex;
            }
          }
        }
      }

      // Educational explanation
      if (!q.explanation || q.explanation.trim().length < minQuizExpLen) {
        errors.push(
          `Review question ${qNum} explanation is too brief (< ${minQuizExpLen} chars). Must explain why the answer is correct.`
        );
        quizFailed = true;
      }
    });
  }

  if (!quizFailed && Array.isArray(content.reviewQuestions) && content.reviewQuestions.length >= minQuestions) {
    checks.quizConsistency = true;
  }

  // -------------------------------------------------------------
  // 6. Duplicate Content & Plagiarism Across Sections
  // -------------------------------------------------------------
  let duplicateDetected = false;

  if (Array.isArray(content.mainConcepts) && content.mainConcepts.length > 1) {
    const conceptExplanations = content.mainConcepts.map((c) => (c.explanation ? c.explanation.trim() : ''));
    const uniqueConceptExps = new Set(conceptExplanations);
    if (uniqueConceptExps.size !== conceptExplanations.length) {
      errors.push('Lesson contains duplicate concept explanations across different main concepts.');
      duplicateDetected = true;
    }

    if (content.overview && conceptExplanations.some((exp) => exp.length > 30 && exp === content.overview.trim())) {
      errors.push('Lesson overview is duplicated verbatim in one of the main concept explanations.');
      duplicateDetected = true;
    }
  }

  if (Array.isArray(content.examples) && content.examples.length > 1) {
    const exampleDescs = content.examples.map((e) => (e.description ? e.description.trim() : ''));
    const uniqueDescs = new Set(exampleDescs);
    if (uniqueDescs.size !== exampleDescs.length) {
      errors.push('Lesson contains duplicate example descriptions across different examples.');
      duplicateDetected = true;
    }
  }

  if (!duplicateDetected) {
    checks.noDuplicateContent = true;
  }

  // -------------------------------------------------------------
  // Final Evaluation
  // -------------------------------------------------------------
  const allPassed =
    checks.hasRequiredFields &&
    checks.substantiveExplanations &&
    checks.noPlaceholders &&
    checks.noCircularDefinitions &&
    checks.quizConsistency &&
    checks.noDuplicateContent &&
    errors.length === 0;

  return {
    valid: allPassed,
    reason: allPassed ? undefined : errors[0],
    errors: errors.length > 0 ? errors : undefined,
    checks,
  };
}
