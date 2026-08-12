export const DEPARTMENT_ACRONYMS: Record<string, string> = {
  "Administration": "ADMIN",
  "Aerospace Engineering": "AE",
  "Artificial Intelligence": "AI",
  "Astronomy and Astrophysics Programme": "AP",
  "Centre for Atmospheric and Oceanic Sciences": "CAOS",
  "Biochemistry": "BC",
  "Bioengineering": "BE",
  "Brain, Computation and Data Science": "BCD",
  "Central Animal Facility": "CAF",
  "Centre for Brain Research": "CBR",
  "Centre for Cryogenic Technology": "CCT",
  "Centre for Infectious Disease Research": "CIDR",
  "Centre for Infrastructure, Sustainable Transportation & Urban Planning": "CISTUP",
  "Centre for Nanoscience and Engineering": "CeNSE",
  "Centre for Society and Policy": "CSP",
  "Chemical Engineering": "CH",
  "Civil Engineering": "CE",
  "Divecha Centre for Climate Change": "DCCC",
  "Computational & Data Sciences": "CDS",
  "Computer Science and Automation": "CSA",
  "Robert Bosch Centre for Cyber Physical Systems": "CPS",
  "Developmental Biology and Genetics": "DBG",
  "Centre for Earth Sciences": "CEaS",
  "Centre for Ecological Sciences": "CES",
  "Electrical Communication Engineering": "ECE",
  "Electrical Engineering": "EE",
  "Department of Electronic Systems Engineering": "DESE",
  "Electronic Systems Engineering": "DESE",
  "Interdisciplinary Centre for Energy Research": "ICER",
  "Centre for High Energy Physics": "CHEP",
  "Inorganic and Physical Chemistry": "IPC",
  "Instrumentation and Applied Physics": "IAP",
  "Management Studies": "MGMT",
  "Materials Engineering": "MT",
  "Materials Research Centre": "MRC",
  "Mathematics": "MA",
  "Mechanical Engineering": "ME",
  "Medical School & Bagchi-Parthasarathy Hospital": "MED",
  "Microbiology and Cell Biology": "MCB",
  "Molecular Biophysics Unit": "MBU",
  "Centre for Neuroscience": "CNS",
  "Organic Chemistry": "OC",
  "Physics": "PH",
  "Isaac Centre for Public Health": "ICPH",
  "Solid State and Structural Chemistry Unit": "SSCU",
  "Supercomputer Education and Research Centre": "SERC",
  "Undergraduate": "UG",
  "Centre for Sustainable Technologies": "CST",
  "Interdisciplinary Centre for Water Research": "ICWaR"
};

export const PREDEFINED_DEPARTMENTS = Object.keys(DEPARTMENT_ACRONYMS).sort();

export function getDepartmentAcronym(department: string | null | undefined): string {
  if (!department) return "IISc";
  
  // Case-insensitive lookup
  const cleanDept = department.trim();
  const foundKey = Object.keys(DEPARTMENT_ACRONYMS).find(
    key => key.toLowerCase() === cleanDept.toLowerCase()
  );
  
  if (foundKey) {
    return DEPARTMENT_ACRONYMS[foundKey];
  }
  
  // Fallback for custom departments
  // Ignore common small words when generating acronyms
  const ignoreWords = new Set(["and", "for", "of", "the", "&", "in"]);
  const words = cleanDept.split(/\s+/).filter(w => w.length > 0 && !ignoreWords.has(w.toLowerCase()));
  
  if (words.length > 1) {
    return words.map(w => w[0].toUpperCase()).join('').substring(0, 5);
  }
  return cleanDept.substring(0, 3).toUpperCase();
}
