import type { Question } from './question-generator';

// Predefined ASVAB practice banks ordered from easiest to hardest per section

export const WK: Question[] = [
  // Tier 1 (Q1–10) - upgrade to middle school / early high school vocabulary & context
  { id: 10001, subject: 'WK' as any, type: 'wk_syn', text: 'Aberration', formulaId: 'wk_aberration', keywords: ['vocab'], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'A departure from what is normal', choices: ['A departure from what is normal', 'A group of animals', 'A type of plant', 'A measurement of mass'], category: 'WK' },
  { id: 10002, subject: 'WK' as any, type: 'wk_syn', text: 'Benevolent', formulaId: 'wk_benevolent', keywords: ['vocab'], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'Kind and generous', choices: ['Cruel and harsh', 'Kind and generous', 'Quick and agile', 'Loud and boisterous'], category: 'WK' },
  { id: 10003, subject: 'WK' as any, type: 'wk_syn', text: 'Candid', formulaId: 'wk_candid', keywords: ['vocab'], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'Truthful and straightforward', choices: ['Secretive', 'Truthful and straightforward', 'Angry', 'Cheerful'], category: 'WK' },
  { id: 10004, subject: 'WK' as any, type: 'wk_syn', text: 'Diligent', formulaId: 'wk_diligent', keywords: ['vocab'], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'Hardworking and careful', choices: ['Quick and careless', 'Hardworking and careful', 'Funny and witty', 'Lazy'], category: 'WK' },
  { id: 10005, subject: 'WK' as any, type: 'wk_syn', text: 'Empathy', formulaId: 'wk_empathy', keywords: ['vocab'], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'Understanding another person’s feelings', choices: ['A kind of math problem', 'Understanding another person’s feelings', 'A physical exercise', 'A musical term'], category: 'WK' },
  { id: 10006, subject: 'WK' as any, type: 'wk_syn', text: 'Fortify', formulaId: 'wk_fortify', keywords: ['vocab'], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'To strengthen or secure', choices: ['To weaken', 'To decorate', 'To strengthen or secure', 'To remove'], category: 'WK' },
  { id: 10007, subject: 'WK' as any, type: 'wk_syn', text: 'Gravitate', formulaId: 'wk_gravitate', keywords: ['vocab'], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'To be attracted or drawn toward', choices: ['To repel', 'To be attracted or drawn toward', 'To melt', 'To freeze'], category: 'WK' },
  { id: 10008, subject: 'WK' as any, type: 'wk_syn', text: 'Hypothesis', formulaId: 'wk_hypothesis', keywords: ['vocab'], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'A proposed explanation for a phenomenon', choices: ['A finished experiment', 'A proposed explanation for a phenomenon', 'A type of cell', 'A geographic region'], category: 'WK' },
  { id: 10009, subject: 'WK' as any, type: 'wk_syn', text: 'Infer', formulaId: 'wk_infer', keywords: ['vocab'], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'To draw a conclusion from evidence', choices: ['To draw a conclusion from evidence', 'To measure temperature', 'To type a letter', 'To swim'], category: 'WK' },
  { id: 10010, subject: 'WK' as any, type: 'wk_syn', text: 'Juxtapose', formulaId: 'wk_juxtapose', keywords: ['vocab'], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'To place side by side for comparison', choices: ['To hide', 'To place side by side for comparison', 'To increase speed', 'To break apart'], category: 'WK' },
  // Tier 2 (Q11–20) - middle/high-school choices
  { id: 10011, subject: 'WK' as any, type: 'wk_syn', text: 'Kinetic', formulaId: 'wk_kinetic', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Relating to motion', choices: ['Relating to motion', 'Relating to heat', 'Relating to light', 'Relating to taste'], category: 'WK' },
  { id: 10012, subject: 'WK' as any, type: 'wk_syn', text: 'Lexicon', formulaId: 'wk_lexicon', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'The vocabulary of a language', choices: ['A small book', 'The vocabulary of a language', 'A writing tool', 'A type of poem'], category: 'WK' },
  { id: 10013, subject: 'WK' as any, type: 'wk_syn', text: 'Mitigate', formulaId: 'wk_mitigate', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'To make less severe', choices: ['To make less severe', 'To increase', 'To ignore', 'To destroy'], category: 'WK' },
  { id: 10014, subject: 'WK' as any, type: 'wk_syn', text: 'Nuance', formulaId: 'wk_nuance', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'A subtle difference in meaning', choices: ['A sharp sound', 'A subtle difference in meaning', 'A large object', 'A mathematical operation'], category: 'WK' },
  { id: 10015, subject: 'WK' as any, type: 'wk_syn', text: 'Ostensible', formulaId: 'wk_ostensible', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Apparent or stated but not necessarily true', choices: ['Obvious and true', 'Apparent or stated but not necessarily true', 'Hidden and secret', 'Very small'], category: 'WK' },
  { id: 10016, subject: 'WK' as any, type: 'wk_syn', text: 'Plausible', formulaId: 'wk_plausible', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Reasonable or believable', choices: ['Impossible', 'Reasonable or believable', 'Complicated', 'Secret'], category: 'WK' },
  { id: 10017, subject: 'WK' as any, type: 'wk_syn', text: 'Quell', formulaId: 'wk_quell', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'To suppress or put an end to', choices: ['To start', 'To suppress or put an end to', 'To build', 'To entertain'], category: 'WK' },
  { id: 10018, subject: 'WK' as any, type: 'wk_syn', text: 'Rational', formulaId: 'wk_rational', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Based on reason or logic', choices: ['Based on reason or logic', 'Based on emotion only', 'A kind of fruit', 'A measure of length'], category: 'WK' },
  { id: 10019, subject: 'WK' as any, type: 'wk_syn', text: 'Substantiate', formulaId: 'wk_substantiate', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'To provide evidence for', choices: ['To provide evidence for', 'To disturb', 'To forget', 'To imagine'], category: 'WK' },
  { id: 10020, subject: 'WK' as any, type: 'wk_syn', text: 'Tantamount', formulaId: 'wk_tantamount', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Equivalent in seriousness', choices: ['Very small', 'Equivalent in seriousness', 'Full of energy', 'Unrelated'], category: 'WK' },
  // Tier 3 (Q21–30) - high-school vocabulary and nuance
  { id: 10021, subject: 'WK' as any, type: 'wk_syn', text: 'Ubiquitous', formulaId: 'wk_ubiquitous', keywords: ['vocab'], partners: [], difficulty: 'hard', difficultyWeight: 3, solveSteps: [], answer: 'Present everywhere', choices: ['Rare', 'Present everywhere', 'Hidden', 'Temporary'], category: 'WK' },
  { id: 10022, subject: 'WK' as any, type: 'wk_syn', text: 'Venerate', formulaId: 'wk_venerate', keywords: ['vocab'], partners: [], difficulty: 'hard', difficultyWeight: 3, solveSteps: [], answer: 'To regard with great respect', choices: ['To ignore', 'To regard with great respect', 'To punish', 'To laugh at'], category: 'WK' },
  { id: 10023, subject: 'WK' as any, type: 'wk_syn', text: 'Whimsical', formulaId: 'wk_whimsical', keywords: ['vocab'], partners: [], difficulty: 'hard', difficultyWeight: 3, solveSteps: [], answer: 'Playfully quaint or fanciful', choices: ['Serious', 'Playfully quaint or fanciful', 'Angry', 'Predictable'], category: 'WK' },
  { id: 10024, subject: 'WK' as any, type: 'wk_syn', text: 'Verbose', formulaId: 'wk_verbose', keywords: ['vocab'], partners: [], difficulty: 'hard', difficultyWeight: 3, solveSteps: [], answer: 'Using more words than needed', choices: ['Quiet', 'Using more words than needed', 'Fast', 'Simple'], category: 'WK' },
  { id: 10025, subject: 'WK' as any, type: 'wk_syn', text: 'Wary', formulaId: 'wk_wary', keywords: ['vocab'], partners: [], difficulty: 'hard', difficultyWeight: 3, solveSteps: [], answer: 'Cautious about possible dangers', choices: ['Excited', 'Cautious about possible dangers', 'Happy', 'Indifferent'], category: 'WK' },
  { id: 10026, subject: 'WK' as any, type: 'wk_syn', text: 'Xenial', formulaId: 'wk_xenial', keywords: ['vocab'], partners: [], difficulty: 'hard', difficultyWeight: 3, solveSteps: [], answer: 'Hospitable or friendly to guests', choices: ['Hostile', 'Hospitable or friendly to guests', 'Lazy', 'Loud'], category: 'WK' },
  { id: 10027, subject: 'WK' as any, type: 'wk_syn', text: 'Yield', formulaId: 'wk_yield', keywords: ['vocab'], partners: [], difficulty: 'hard', difficultyWeight: 3, solveSteps: [], answer: 'To give way or produce', choices: ['To break', 'To give way or produce', 'To increase', 'To remove'], category: 'WK' },
  { id: 10028, subject: 'WK' as any, type: 'wk_syn', text: 'Zealous', formulaId: 'wk_zealous', keywords: ['vocab'], partners: [], difficulty: 'hard', difficultyWeight: 3, solveSteps: [], answer: 'Marked by fervent partisanship', choices: ['Apathetic', 'Marked by fervent partisanship', 'Slow', 'Unclear'], category: 'WK' },
  { id: 10029, subject: 'WK' as any, type: 'wk_syn', text: 'Ambivalent', formulaId: 'wk_ambivalent', keywords: ['vocab'], partners: [], difficulty: 'hard', difficultyWeight: 3, solveSteps: [], answer: 'Having mixed feelings', choices: ['Certain', 'Having mixed feelings', 'Angry', 'Calm'], category: 'WK' },
  { id: 10030, subject: 'WK' as any, type: 'wk_syn', text: 'Cognizant', formulaId: 'wk_cognizant', keywords: ['vocab'], partners: [], difficulty: 'hard', difficultyWeight: 3, solveSteps: [], answer: 'Having knowledge or awareness', choices: ['Unaware', 'Having knowledge or awareness', 'Far away', 'Tiny'], category: 'WK' },
  // Tier 4 (Q31–40) - advanced/high-school vocabulary
  { id: 10031, subject: 'WK' as any, type: 'wk_syn', text: 'Anachronistic', formulaId: 'wk_anachronistic', keywords: ['vocab'], partners: [], difficulty: 'very-hard', difficultyWeight: 4, solveSteps: [], answer: 'Belonging to another period', choices: ['Timely', 'Belonging to another period', 'Modern', 'Futuristic'], category: 'WK' },
  { id: 10032, subject: 'WK' as any, type: 'wk_syn', text: 'Capitulate', formulaId: 'wk_capitulate', keywords: ['vocab'], partners: [], difficulty: 'very-hard', difficultyWeight: 4, solveSteps: [], answer: 'To surrender or give up', choices: ['To win', 'To surrender or give up', 'To improve', 'To calculate'], category: 'WK' },
  { id: 10033, subject: 'WK' as any, type: 'wk_syn', text: 'Deference', formulaId: 'wk_deference', keywords: ['vocab'], partners: [], difficulty: 'very-hard', difficultyWeight: 4, solveSteps: [], answer: 'Respectful submission', choices: ['Anger', 'Respectful submission', 'Noise', 'Movement'], category: 'WK' },
  { id: 10034, subject: 'WK' as any, type: 'wk_syn', text: 'Epitome', formulaId: 'wk_epitome', keywords: ['vocab'], partners: [], difficulty: 'very-hard', difficultyWeight: 4, solveSteps: [], answer: 'A perfect example', choices: ['A perfect example', 'A mistake', 'A large number', 'A device'], category: 'WK' },
  { id: 10035, subject: 'WK' as any, type: 'wk_syn', text: 'Facetious', formulaId: 'wk_facetious', keywords: ['vocab'], partners: [], difficulty: 'very-hard', difficultyWeight: 4, solveSteps: [], answer: 'Treating serious issues with inappropriate humor', choices: ['Serious', 'Treating serious issues with inappropriate humor', 'Kind', 'Loud'], category: 'WK' },
  { id: 10036, subject: 'WK' as any, type: 'wk_syn', text: 'Garrulous', formulaId: 'wk_garrulous', keywords: ['vocab'], partners: [], difficulty: 'master', difficultyWeight: 5, solveSteps: [], answer: 'Excessively talkative', choices: ['Quiet', 'Excessively talkative', 'Sleepy', 'Hungry'], category: 'WK' },
  { id: 10037, subject: 'WK' as any, type: 'wk_syn', text: 'Hubris', formulaId: 'wk_hubris', keywords: ['vocab'], partners: [], difficulty: 'master', difficultyWeight: 5, solveSteps: [], answer: 'Excessive pride or self-confidence', choices: ['Humility', 'Excessive pride or self-confidence', 'Curiosity', 'Fear'], category: 'WK' },
  { id: 10038, subject: 'WK' as any, type: 'wk_syn', text: 'Idiosyncrasy', formulaId: 'wk_idiosyncrasy', keywords: ['vocab'], partners: [], difficulty: 'master', difficultyWeight: 5, solveSteps: [], answer: 'A distinctive or peculiar feature', choices: ['A common habit', 'A distinctive or peculiar feature', 'A law', 'A number'], category: 'WK' },
  { id: 10039, subject: 'WK' as any, type: 'wk_syn', text: 'Jurisprudence', formulaId: 'wk_jurisprudence', keywords: ['vocab'], partners: [], difficulty: 'master', difficultyWeight: 5, solveSteps: [], answer: 'The theory or philosophy of law', choices: ['A type of plant', 'A method of cooking', 'The theory or philosophy of law', 'A geometric shape'], category: 'WK' },
  { id: 10040, subject: 'WK' as any, type: 'wk_syn', text: 'Kinetic', formulaId: 'wk_kinetic', keywords: ['vocab'], partners: [], difficulty: 'master', difficultyWeight: 5, solveSteps: [], answer: 'Relating to motion', choices: ['Relating to stillness', 'Relating to motion', 'A color', 'A sound'], category: 'WK' },
];

// Paragraph comprehension: each passage with its Qs (20 total)
export const PC: Question[] = [];
{
  const p1 = `Researchers studying nocturnal ecosystems have observed that artificial light at night can disrupt biological rhythms. Many species rely on predictable light-dark cycles to time feeding, migration, and reproduction. Increasing illumination can alter predator-prey interactions and interfere with plant photoperiods, producing cascading ecological effects.`;
  PC.push({ id: 20001, subject: 'PC' as any, type: 'pc', text: `${p1}\nQ: What is the main idea of the passage?`, formulaId: 'pc_p1_q1', keywords: ['reading','ecology'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Artificial light at night disrupts biological rhythms and ecosystems', choices: ['Artificial light at night disrupts biological rhythms and ecosystems','Nocturnal animals are increasing in number','Photoperiods are unaffected by artificial lighting','Light pollution benefits predators only'], category: 'PC' });
  PC.push({ id: 20002, subject: 'PC' as any, type: 'pc', text: `${p1}\nQ: According to the passage, which of the following is a consequence of increased nighttime illumination?`, formulaId: 'pc_p1_q2', keywords: ['reading','ecology'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Altered predator-prey interactions', choices: ['Altered predator-prey interactions','Increased photosynthesis at night','Reduced daylight hours','Stronger magnetic fields'], category: 'PC' });
  PC.push({ id: 20003, subject: 'PC' as any, type: 'pc', text: `${p1}\nQ: The word "photoperiods" most nearly refers to:`, formulaId: 'pc_p1_q3', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'The length of day and night that influences biological activity', choices: ['The length of day and night that influences biological activity','A type of photography used by researchers','The brightness of artificial lights','Migration routes'], category: 'PC' });
  PC.push({ id: 20004, subject: 'PC' as any, type: 'pc', text: `${p1}\nQ: Which inference is best supported by the passage?`, formulaId: 'pc_p1_q4', keywords: ['reading','inference'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Changes to light cycles can have indirect ecological consequences', choices: ['Changes to light cycles can have indirect ecological consequences','All species will adapt quickly','Only plants are affected','Light has no biological effect'], category: 'PC' });
  PC.push({ id: 20005, subject: 'PC' as any, type: 'pc', text: `${p1}\nQ: Which statement is least supported by the passage?`, formulaId: 'pc_p1_q5', keywords: ['reading','critical'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Light pollution strengthens ecosystems', choices: ['Light pollution strengthens ecosystems','Light affects feeding and reproduction','Light can interfere with migration','Photoperiods are important'], category: 'PC' });
}
{
  const p2 = `Large infrastructure projects often require trade-offs between initial capital expenditure and long-term resilience. Engineers may choose materials and designs that reduce maintenance frequency but increase upfront cost; conversely, cheaper materials can lead to earlier failure and higher lifecycle expense. Policymakers must weigh present budgets against future liabilities when approving projects.`;
  PC.push({ id: 20006, subject: 'PC' as any, type: 'pc', text: `${p2}\nQ: Which best summarizes the passage?`, formulaId: 'pc_p2_q6', keywords: ['reading','economics'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Infrastructure choices involve trade-offs between upfront cost and long-term resilience', choices: ['Infrastructure choices involve trade-offs between upfront cost and long-term resilience','Cheaper materials are always preferable','Maintenance is unnecessary for modern projects','Upfront cost is irrelevant to policymakers'], category: 'PC' });
  PC.push({ id: 20007, subject: 'PC' as any, type: 'pc', text: `${p2}\nQ: According to the passage, what is a potential result of choosing cheaper materials?`, formulaId: 'pc_p2_q7', keywords: ['reading','inference'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Earlier failure and higher lifecycle expense', choices: ['Earlier failure and higher lifecycle expense','Lower immediate labor costs','Less need for inspections','Fewer political debates'], category: 'PC' });
  PC.push({ id: 20008, subject: 'PC' as any, type: 'pc', text: `${p2}\nQ: The word "resilience" most nearly means:`, formulaId: 'pc_p2_q8', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Ability to withstand stress and recover', choices: ['Ability to withstand stress and recover','Low cost','High visibility','Quick installation'], category: 'PC' });
  PC.push({ id: 20009, subject: 'PC' as any, type: 'pc', text: `${p2}\nQ: Which inference follows from the passage?`, formulaId: 'pc_p2_q9', keywords: ['reading','critical'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Decision-makers should consider long-term costs, not just initial price', choices: ['Decision-makers should consider long-term costs, not just initial price','Maintenance can be ignored if budgets are tight','Materials have no impact on lifecycle expense','Engineers should always choose cheapest materials'], category: 'PC' });
  PC.push({ id: 20010, subject: 'PC' as any, type: 'pc', text: `${p2}\nQ: Which is least supported by the passage?`, formulaId: 'pc_p2_q10', keywords: ['reading','critical'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Upfront cost is irrelevant to decision-making', choices: ['Upfront cost is irrelevant to decision-making','Lifecycle costs matter','Design choices affect maintenance','Policy must balance budgets and liabilities'], category: 'PC' });
}
{
  const p3 = `Scholars debate whether digital interaction supplements or substitutes for in-person contact. Synchronous platforms (video calls) approximate face-to-face communication, whereas asynchronous messaging can fragment conversation and reduce social cues. Some researchers argue that the net effect depends on context and use patterns rather than the technology alone.`;
  PC.push({ id: 20011, subject: 'PC' as any, type: 'pc', text: `${p3}\nQ: Which conclusion does the author suggest?`, formulaId: 'pc_p3_q11', keywords: ['reading','synthesis'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'The effect of digital interaction depends on context and use patterns', choices: ['The effect of digital interaction depends on context and use patterns','Digital tools always harm relationships','All synchronous communication is superior','Asynchronous messaging is universally beneficial'], category: 'PC' });
  PC.push({ id: 20012, subject: 'PC' as any, type: 'pc', text: `${p3}\nQ: According to the passage, which platform type approximates face-to-face communication?`, formulaId: 'pc_p3_q12', keywords: ['reading'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Video calls', choices: ['Video calls','Asynchronous messaging','Email only','Forums'], category: 'PC' });
  PC.push({ id: 20013, subject: 'PC' as any, type: 'pc', text: `${p3}\nQ: The word "asynchronous" most nearly means:`, formulaId: 'pc_p3_q13', keywords: ['vocab'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Not occurring at the same time', choices: ['Not occurring at the same time','Occurring simultaneously','Fast and immediate','Incorrect'], category: 'PC' });
  PC.push({ id: 20014, subject: 'PC' as any, type: 'pc', text: `${p3}\nQ: Which statement best reflects the author’s perspective?`, formulaId: 'pc_p3_q14', keywords: ['reading','analysis'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Researchers find the impact varies by context', choices: ['Researchers find the impact varies by context','Technology replaces all in-person contact','In-person is obsolete','Asynchronous messaging is best'], category: 'PC' });
  PC.push({ id: 20015, subject: 'PC' as any, type: 'pc', text: `${p3}\nQ: Which inference is supported by the passage?`, formulaId: 'pc_p3_q15', keywords: ['reading','inference'], partners: [], difficulty: 'medium', difficultyWeight: 2, solveSteps: [], answer: 'Evaluations must consider how tools are used, not just what they are', choices: ['Evaluations must consider how tools are used, not just what they are','All digital interaction is detrimental','Only face-to-face contact matters','Synchronous tools are always harmful'], category: 'PC' });
}
{
  const p4 = `In complex systems, risk management balances the probability of adverse outcomes against their potential impact. Techniques such as diversification, redundancy, and contingency planning reduce vulnerability but require resources. Effective strategies acknowledge uncertainty and prioritize actions that decrease the severity of likely failures.`;
  PC.push({ id: 20016, subject: 'PC' as any, type: 'pc', text: `${p4}\nQ: Which best describes the passage's focus?`, formulaId: 'pc_p4_q16', keywords: ['reading','risk'], partners: [], difficulty: 'very-hard', difficultyWeight: 4, solveSteps: [], answer: 'Risk management strategies to reduce vulnerability', choices: ['Risk management strategies to reduce vulnerability','Techniques to increase profit only','Methods to eliminate uncertainty entirely','Ways to avoid all risk'], category: 'PC' });
  PC.push({ id: 20017, subject: 'PC' as any, type: 'pc', text: `${p4}\nQ: Which technique mentioned reduces system vulnerability by providing backups?`, formulaId: 'pc_p4_q17', keywords: ['reading','vocab'], partners: [], difficulty: 'very-hard', difficultyWeight: 4, solveSteps: [], answer: 'Redundancy', choices: ['Redundancy','Diversification','Contingency planning','Minimization'], category: 'PC' });
  PC.push({ id: 20018, subject: 'PC' as any, type: 'pc', text: `${p4}\nQ: The word "contingency" most nearly means:`, formulaId: 'pc_p4_q18', keywords: ['vocab'], partners: [], difficulty: 'very-hard', difficultyWeight: 4, solveSteps: [], answer: 'A plan for an unforeseen event', choices: ['A plan for an unforeseen event','An expensive resource','A guaranteed outcome','A short-term profit'], category: 'PC' });
  PC.push({ id: 20019, subject: 'PC' as any, type: 'pc', text: `${p4}\nQ: Which idea is implied by the passage?`, formulaId: 'pc_p4_q19', keywords: ['reading','inference'], partners: [], difficulty: 'very-hard', difficultyWeight: 4, solveSteps: [], answer: 'Acknowledging uncertainty is part of good strategy', choices: ['Acknowledging uncertainty is part of good strategy','All risks can be avoided','Resources should never be used for backups','Uncertainty is irrelevant'], category: 'PC' });
  PC.push({ id: 20020, subject: 'PC' as any, type: 'pc', text: `${p4}\nQ: What is the passage's recommended priority?`, formulaId: 'pc_p4_q20', keywords: ['reading','critical'], partners: [], difficulty: 'very-hard', difficultyWeight: 4, solveSteps: [], answer: 'Prioritize actions that reduce severity of likely failures', choices: ['Prioritize actions that reduce severity of likely failures','Maximize short-term gains','Eliminate all redundancy','Ignore contingency plans'], category: 'PC' });
}

// General Science (GS) — 30 items
export const GS: Question[] = [];
const gsQs = [
  // easier (grade-appropriate but not trivial)
  ['In the respiratory system, which structure contains the alveoli where gas exchange occurs?', 'Lungs'],
  ['Which chamber of the heart receives oxygenated blood from the lungs?', 'Left atrium'],
  ['Which gas is primarily used by cells during cellular respiration?', 'Oxygen'],
  ['Which layer of Earth lies directly beneath the crust and is composed mostly of solid rock?', 'Mantle'],
  ['Plants capture light energy to make sugars primarily in which organelle?', 'Chloroplast'],
  ['What term describes an organism that produces its own food using sunlight?', 'Autotroph'],
  // medium
  ['Which property of water allows it to moderate temperature by storing large amounts of heat?', 'High specific heat'],
  ['What is the primary function of mitochondria in eukaryotic cells?', 'Produce ATP'],
  ['Which laboratory technique separates mixtures by passing them through a porous barrier?', 'Filtration'],
  ['In genetics, what term describes a variant form of a gene?', 'Allele'],
  ['Which of the following best describes kinetic energy?', 'Energy of motion'],
  ['What is the pH of a neutral aqueous solution at 25°C?', '7'],
  // hard
  ['Which law relates voltage, current, and resistance in an electrical circuit?', "Ohm's law"],
  ['What process describes cumulative changes in allele frequencies in a population over time?', 'Evolution'],
  ['Which process returns carbon to the atmosphere when organisms respire?', 'Respiration'],
  ['What primarily causes the phases of the Moon as seen from Earth?', 'Relative positions of Earth, Moon, and Sun'],
  ['Why does white light separate into colors when passing through a prism?', 'Refraction'],
  ['What role does RNA polymerase play during gene expression?', 'Catalyzes transcription'],
  // very-hard
  ['What does an ecosystem’s carrying capacity describe?', 'Maximum population the environment can sustain'],
  ['Which concept explains tidal bulges on Earth produced by a secondary body’s gravity?', 'Tidal forces'],
  ['In thermodynamics, entropy is a measure of what?', 'Degree of disorder or randomness'],
  ['Which meiotic mechanism increases genetic variation by exchanging DNA between homologous chromosomes?', 'Crossing over'],
  ['What early evidence supported the idea of continental drift?', 'Matching fossil records and complementary coastlines'],
  ['Which reaction type involves the transfer of electrons between reactants?', 'Redox reaction'],
  // master
  ['Why does adding greenhouse gases to the atmosphere tend to increase global mean temperature?', 'They trap outgoing infrared radiation, increasing net retained energy'],
  ['What principle allows radiometric dating to estimate the age of rocks?', 'Radioactive decay with known half-lives'],
  ['How do prokaryotic and eukaryotic cells differ in DNA organization?', 'Eukaryotes have membrane-bound nuclei; prokaryotes have circular DNA in the cytoplasm'],
  ['Define an ecological niche in one phrase.', 'The role and position of a species including its resource use and interactions'],
  ['Why does ocean acidification reduce calcification in marine organisms?', 'Lower pH reduces carbonate ion availability needed for shell formation'],
  ['How does plate tectonics explain the clustering of earthquakes and volcanoes?', 'Plate boundary movement concentrates stress and magmatism at plate edges']
];
// Provide a small map of contextual distractors for early GS items to make them less obvious
const gsDistractors: Record<number, string[]> = {
  // easy (aligned with gsQs order)
  0: ['Heart', 'Stomach', 'Liver'],
  1: ['Right atrium', 'Left ventricle', 'Right ventricle'],
  2: ['Carbon dioxide', 'Nitrogen', 'Glucose'],
  3: ['Core', 'Crust', 'Lithosphere'],
  4: ['Mitochondria', 'Nucleus', 'Ribosome'],
  5: ['Heterotroph', 'Omnivore', 'Decomposer'],
  // medium
  6: ['Low viscosity', 'High surface tension', 'Low density'],
  7: ['Store genetic material', 'Produce proteins', 'Provide structure'],
  8: ['Distillation', 'Evaporation', 'Chromatography'],
  9: ['Chromosome', 'Trait', 'Genome'],
  10: ['Stored energy', 'Energy from chemical bonds', 'Energy produced by reaction'],
  11: ['1', '14', '0'],
  // hard
  12: ['Newton’s law', 'Faraday’s law', 'Boyle’s law'],
  13: ['Adaptation', 'Migration', 'Homeostasis'],
  14: ['Photosynthesis', 'Decomposition', 'Precipitation'],
  15: ['Earth’s shadow', 'Moon’s atmosphere', 'Lunar tectonics'],
  16: ['Reflection', 'Diffusion', 'Conduction'],
  17: ['Replicates DNA', 'Translates RNA to protein', 'Degrades mRNA'],
  // very-hard
  18: ['Minimum population for survival', 'Number of species', 'Average lifespan'],
  19: ['Coriolis effect', 'Solar radiation', 'Plate tectonics'],
  20: ['Energy capacity', 'Temperature', 'Pressure'],
  21: ['Binary fission', 'Mitosis', 'Endocytosis'],
  22: ['Similar climates', 'Same languages', 'Identical rivers'],
  23: ['Acid-base reaction', 'Polymerization', 'Hydrolysis'],
  // master
  24: ['They block incoming sunlight', 'They reflect heat back to space', 'They reduce cloud cover'],
  25: ['Fossil similarity', 'Layer counting only', 'Magnetic orientation'],
  26: ['Prokaryotes have mitochondria', 'Eukaryotes lack ribosomes', 'Prokaryotes have linear chromosomes'],
  27: ['Geographic location only', 'Food chain rank only', 'Population density'],
  28: ['Increases water temperature', 'Decreases salinity', 'Increases oxygen'],
  29: ['Random geological events', 'Weather patterns', 'Meteor impacts']
};

for (let i = 0; i < gsQs.length; i++) {
  const q = gsQs[i];
  // Distribute across five tiers (easier to master-level questions)
  const difficulty = i < 6 ? 'easy' : (i < 12 ? 'medium' : (i < 18 ? 'hard' : (i < 24 ? 'very-hard' : 'master')));
  const baseChoices = gsDistractors[i] ? [q[1], ...gsDistractors[i]] : [q[1]];
  // ensure length >=4 and fill with contextual fallbacks (no empty choices)
  const fallback = ['None of the above', 'Not applicable', 'All of the above', 'Unknown'];
  let fi = 0;
  while (baseChoices.length < 4) {
    // Prefer any available distractor in the map for this index
    const extra = (gsDistractors[i] && gsDistractors[i][fi]) ? gsDistractors[i][fi] : fallback[fi % fallback.length];
    baseChoices.push(extra);
    fi++;
  }
  // ensure none of the choices are empty strings
  const cleanChoices = baseChoices.map(c => (String(c).trim() === '' ? fallback[0] : c));
  GS.push({ id: 30000 + i + 1, subject: 'GS' as any, type: 'gs', text: q[0], formulaId: 'gs_' + (i+1), keywords: ['science'], partners: [], difficulty: difficulty as any, difficultyWeight: difficulty === 'easy' ? 1 : (difficulty === 'medium' ? 2 : (difficulty === 'hard' ? 3 : (difficulty === 'very-hard' ? 4 : 5))), solveSteps: [], answer: q[1], choices: cleanChoices.slice(0,4), category: 'GS' });
}

// Math Knowledge (MK) — 30 items
export const MK: Question[] = [];
const mkTexts: Array<[string, string | number]> = [
  // easy
  ['Solve for x: x + 5 = 12', 7], ['Evaluate: 3^2 + 4', 13], ['Convert 0.2 to a fraction', '1/5'], ['What is 25% of 200?', 50], ['Area of rectangle 4 by 7', 28], ['Simplify: 2(3 + 4)', 14],
  // medium
  ['Solve: 2x - 3 = 11', 7], ['Simplify: 3/4 + 1/8', '7/8'], ['Solve: 5x = 45', 9], ['What is the median of [3,7,9,11,20]?', 9], ['Convert 3.5 to a fraction', '7/2'], ['What is 15% of 240?', 36],
  // hard
  ['Solve for positive x: x^2 = 49', 7], ['Simplify: (6*3) / (9/2)', 4], ['Area of circle radius 3 (in terms of π)', '9π'], ['Slope of line through (1,2) and (3,8)', 3], ['Simplify: (x^3)/(x^2)', 'x'], ['Solve: (1/3)x = 4', 12], ['LCM of 9 and 12', 36], ['Simplify: 4^3 - 2^5', 32],
  // very-hard
  ['Solve: 2x + 3 = 7x - 8', '11/5'], ['One root of x^2 - 5x + 6 = 0 is', 2], ['Surface area of a cube with side 4', 96], ['Simplify: (3/4) ÷ (1/2)', '3/2'], ['Convert 150° to radians', '5π/6'], ['If y = 2x + b passes through (1,5), find b', 3],
  // master
  ['Positive root of x^2 - 2x - 8 = 0', 4], ['Simplify: (x^2 - 1)/(x - 1)', 'x + 1'], ['Probability of drawing two aces without replacement', '1/221'], ['Evaluate: (2^4)*(3^2) - (5*4)', 124]
];
for (let i = 0; i < mkTexts.length; i++) {
  const t = mkTexts[i];
  const difficulty = i < 6 ? 'easy' : (i < 12 ? 'medium' : (i < 20 ? 'hard' : (i < 26 ? 'very-hard' : 'master')));
  // Generate plausible distractors for numeric answers
  const makeChoices = (ans: string | number) => {
    if (typeof ans === 'number') {
      const a = ans as number;
      const cands = [a, a + 1, Math.max(0, a - 1), a + 2];
      return cands;
    }
    // For fraction strings or textual answers, include similar-looking options
    const s = String(ans);
    if (s.includes('/')) {
      const [n, d] = s.split('/').map(x => Number(x));
      if (!Number.isNaN(n) && !Number.isNaN(d)) {
        return [s, `${Math.max(1, n - 1)}/${d}`, `${Math.min(d, n + 1)}/${d}`, `${n}/${Math.max(1, d + 1)}`];
      }
    }
    return [s, `${s} approximately`, `~${s}`, `Close to ${s}`];
  };

  MK.push({ id: 40000 + i + 1, subject: 'MK' as any, type: 'mk', text: t[0], formulaId: 'mk_' + (i+1), keywords: ['math'], partners: [], difficulty: difficulty as any, difficultyWeight: difficulty === 'easy' ? 1 : (difficulty === 'medium' ? 2 : (difficulty === 'hard' ? 3 : (difficulty === 'very-hard' ? 4 : 5))), solveSteps: [], answer: t[1], choices: makeChoices(t[1]), category: 'MK' });
}

// Arithmetic Reasoning (AR) — 35 items
export const AR: Question[] = [];
// Sanitize AR free-text prompts that may include inline colon-number tables such as:
// "John: 5, 8, 8\nAmy: 6, 2, 7" -> "John sold 5, 8, and 8 on consecutive days. Amy sold 6, 2, and 7 on consecutive days." (keeps any trailing question intact)
export function sanitizeARText(s: string): string {
  if (!s || typeof s !== 'string') return s;
  const lines = s.split('\n');
  const colonRegex = /^\s*([A-Za-z][A-Za-z \-']+?):\s*([0-9\.\/,\s]+)\s*$/;
  let replaced = false;
  const outLines: string[] = [];
  for (const line of lines) {
    const m = line.match(colonRegex);
    if (m) {
      const name = m[1].trim();
      const nums = m[2].split(',').map(x => x.trim()).filter(Boolean);
      let numsText = '';
      if (nums.length === 1) numsText = nums[0];
      else if (nums.length === 2) numsText = `${nums[0]} and ${nums[1]}`;
      else numsText = `${nums.slice(0, -1).join(', ')}, and ${nums[nums.length - 1]}`;
      outLines.push(`${name} sold ${numsText} on consecutive days.`);
      replaced = true;
    } else {
      outLines.push(line);
    }
  }
  if (!replaced) return s;
  // join with spaces, normalize whitespace but preserve trailing question marks
  const joined = outLines.join(' ').replace(/\s+/g, ' ').trim();
  return joined;
}
const arTexts: Array<[string, string | number]> = [
  // easy: include fractions, decimals, percentages in clear word-problem form
  ['A recipe requires 3/4 cup of sugar per batch. How much sugar is needed for 6 batches?', '4.5'],
  ['If a 2.5 km walk takes 30 minutes, what is the average speed in km/h?', '5'],
  ['What is 15% of 240?', '36'],
  ['Divide 7/8 by 1/4. What is the result?', '3.5'],
  ['A $12.50 item is sold with a 20% discount. What is the sale price?', '10'],
  ['If 2/3 of a number is 18, what is the number?', '27'],

  // medium: multi-step and mixed numbers
  ['A tank is 3/4 full and holds 24 liters when full. How many liters are currently in the tank?', '18'],
  ['Two pipes fill a pool: A in 3 hours, B in 4 hours. Working together, how long to fill the pool?', '1.7142857143'],
  ['Convert 3.75 to a fraction.', '15/4'],
  ['If you earn $15.50 per hour and work 36.5 hours, what is your gross pay?', '565.75'],
  ['A quantity increases by 25% and then decreases by 20%. What is the overall percent change?', '0'],
  ['What is the sum of the mixed numbers 1 2/3 and 2 1/4?', '3.9166666667'],

  // hard: fractions in ratios, percentages, rates, combined reasoning
  ['A 30% solution contains 30 mL solute per 100 mL. How many mL of solute are in 750 mL?', '225'],
  ['A car uses 6.5 liters per 100 km. How many liters for 350 km?', '22.75'],
  ['If a population grows by 8% annually, what is approximate growth factor after 3 years?', '1.259712'],
  ['A recipe calls for 2 1/2 cups; you only want 60% of the recipe. How many cups are needed?', '1.5'],
  ['If 4 people share $125 in ratio 2:3:4:6, how much does the second person receive?', '25'],
  ['Solve for x: (1/2)x + 3 = 11', '16'],

  // very-hard: multi-step with fractions, decimals, percentages and reasoning
  ['An investment yields 6% simple interest annually. How much interest on $1200 after 2.5 years?', '180'],
  ['A mixture contains 40% acid. How much water must be added to 10 L to make it 25% acid?', '5'],
  ['Product A costs $250 and is marked up 18% then discounted 10%. What is final price?', '247.5'],
  ['Two trains approach each other 300 km apart. One at 80 km/h, the other at 70 km/h. How long until they meet?', '1.7647058824'],
  ['If y varies directly as x and y=12 when x=4, what is y when x=7?', '21'],

  // master: challenging multi-step or numeric reasoning with fractions and probability
  ['A bag has 6 red, 4 blue, and 5 green marbles. If two are drawn without replacement, what is the probability both are red?', '15/210'],
  ['Solve: (3/4)x - (1/3)x = 10', '24'],
  ['A geometric series has first term 8 and ratio 1/2; sum of infinite series?', '16'],
  ['If a loan of $500 at 5% annual compound interest is compounded quarterly for 2 years, what is the amount (rounded to 2 decimals)?', '552.81'],
  ['A 3:5 mixture requires total 40 liters. How many liters of the first component?', '15']
];
for (let i = 0; i < arTexts.length; i++) {
  const t = arTexts[i];
  const difficulty = i < 6 ? 'easy' : (i < 12 ? 'medium' : (i < 22 ? 'hard' : (i < 30 ? 'very-hard' : 'master')));
  const makeArChoices = (ans: string | number) => {
    if (typeof ans === 'number') {
      const a = ans as number;
      return [a, a - 1, a + 1, a + Math.max(2, Math.round(a * 0.1))];
    }
    const s = String(ans);
    // simple heuristics for fractional or string answers
    if (s.includes('/')) {
      const [n, d] = s.split('/').map(x => Number(x));
      if (!Number.isNaN(n) && !Number.isNaN(d)) return [s, `${n-1}/${d}`, `${n+1}/${d}`, `${n}/${d+1}`];
    }
    return [s, `${s} (approx)`, `~${s}`, `Close to ${s}`];
  };

  const rawText = String(t[0] || '');
  const text = sanitizeARText(rawText);
  AR.push({ id: 50000 + i + 1, subject: 'AR' as any, type: 'ar', text, formulaId: 'ar_' + (i+1), keywords: ['arithmetic'], partners: [], difficulty: difficulty as any, difficultyWeight: difficulty === 'easy' ? 1 : (difficulty === 'medium' ? 2 : (difficulty === 'hard' ? 3 : (difficulty === 'very-hard' ? 4 : 5))), solveSteps: [], answer: t[1], choices: makeArChoices(t[1]), category: 'AR' });
}

export default { WK, PC, GS, MK, AR };
