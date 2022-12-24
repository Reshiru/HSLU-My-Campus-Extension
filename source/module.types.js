const BACHELOR_DESC_URL = "https://mycampus.hslu.ch/de-ch/info-i/infos-und-dokumente/bachelor/moduleinschreibung/modulbeschriebe/";
const USER_API_URL = "https://mycampus.hslu.ch/de-ch/api/anlasslist/load/?page=1&per_page=500&datasourceid={0}&filters[]=2156";

const NAME_CORE_MODULES = "Kernmodule";
const NAME_PROJECT_MODULES = "Projektmodule";
const NAME_EXTENDED_MODULES = "Erweiterungsmodule";
const NAME_ADDITIONAL_MODULES = "Zusatzmodule";
const NAME_INTENSIVE_MODULES = "Blockwocken";
const NAME_INDIVIDUAL_MODULES = "Individuell";

const MODULE_DESCRIPTION_LINK_CONTAINS = "modulbeschrieb";
const INDIVIDUAL_CREDITS = "ANRECHINDIVID";
const ISA_MODULES = "_ISA";
const ISA_MODULES_AS = NAME_ADDITIONAL_MODULES;
const MAPPING_TABLE_TEMPLATE = {
    [NAME_INDIVIDUAL_MODULES]: [0, []],
    [NAME_CORE_MODULES]: [0, []],
    [NAME_PROJECT_MODULES]: [0, []],
    [NAME_EXTENDED_MODULES]: [0, []],
    [NAME_ADDITIONAL_MODULES]: [0, []],
};

const MODULE_SHORT_REGEX = /\((.*?)\)/g;
const MODULE_SHORT_REGEX_API = /\_(.*?)\./g;

const PREV_MODULE_DECLARATIONS_MAP = [
    [x => x.includes("Artificial" && "Intelligence"), x => x.includes("I.BA_MLPW."), NAME_CORE_MODULES],
    [x => x.includes("Artificial" && "Intelligence"), x => x.includes("I.BA_OOP_E.F2201" || "I.BA_OOP_E.F2202"), NAME_EXTENDED_MODULES],
    [x => x.includes("Artificial" && "Intelligence"), x => x.includes("I.BA_REUF"), NAME_ADDITIONAL_MODULES],
];

var availableBachelors = [];
var moduleMap = undefined;
var notAssignableModules = [];
var mappedEtcs = undefined;

const getDataSource = () => window.jsBridge.options.dataSourceId;

// SEE: https://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format
String.prototype.formatUnicorn = String.prototype.formatUnicorn ||
function () {
    "use strict";
    let str = this.toString();
    if (arguments.length) {
        let t = typeof arguments[0];
        let key;
        let args = ("string" === t || "number" === t) ?
            Array.prototype.slice.call(arguments)
            : arguments[0];

        for (key in args) {
            str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
        }
    }

    return str;
};

String.prototype.levenshteinDistance =  String.prototype.levenshteinDistance || function(b) {
    "use strict";
    let a = this.toString();
    // Create a two-dimensional array to store the distances between the substrings of a and b
    const distance = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
    // Set the distance of the first row and column to the index of the corresponding element
    for (let i = 0; i <= a.length; i++) {
      distance[0][i] = i;
    }
    for (let j = 0; j <= b.length; j++) {
      distance[j][0] = j;
    }
  
    // Calculate the distance for each pair of substrings
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        distance[j][i] = Math.min(distance[j][i - 1] + 1, distance[j - 1][i] + 1, distance[j - 1][i - 1] + cost);
      }
    }
  
    // Return the distance of the last element
    return distance[b.length][a.length];
};

function loadAvailableBachelors() {
    console.log("loadAvailableBachelors");
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
    
        xhr.onload = () => {
            let bachelors = Array.from(xhr.responseXML.documentElement.getElementsByClassName("download-content")[0].getElementsByTagName("a"));
            let mappedBachelors = [];
            bachelors.forEach(bachelor => mappedBachelors.push([bachelor.children[0].innerText, bachelor.href]));
            console.log("loadAvailableBachelors resolved")
            resolve(mappedBachelors);
        }
    
        xhr.open("GET", BACHELOR_DESC_URL);
        xhr.responseType = "document";
        xhr.send();
    });
}

function loadModuleMap(selectedBachelor) {
    console.log("loadModuleMap")
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
    
        xhr.onload = () => {
            let modules = Array.from(xhr.responseXML.documentElement.querySelectorAll("h2, ul"));
            let currectModuleType = undefined;
            let sections = {};
        
            modules.forEach(module => {
                if (module.tagName.toLowerCase() == "h2") {
                    if (module.innerText.toLowerCase().includes(NAME_CORE_MODULES.toLowerCase())) {
                        currectModuleType = NAME_CORE_MODULES;
                    }
                    else if (module.innerText.toLowerCase().includes(NAME_PROJECT_MODULES.toLowerCase())) {
                        currectModuleType = NAME_PROJECT_MODULES;
                    }
                    else if (module.innerText.toLowerCase().includes(NAME_EXTENDED_MODULES.toLowerCase())) {
                        currectModuleType = NAME_EXTENDED_MODULES;
                    }
                    else if (module.innerText.toLowerCase().includes(NAME_ADDITIONAL_MODULES.toLowerCase())) {
                        currectModuleType = NAME_ADDITIONAL_MODULES;
                    }
                    else if (module.innerText.toLowerCase().includes(NAME_INTENSIVE_MODULES.toLowerCase())) {
                        currectModuleType = NAME_INTENSIVE_MODULES;
                    }
                }
                else if (currectModuleType) {
                    // Get all links below the title
                    let links = Array.from(module.getElementsByTagName("a"));
                    let moduleDescriptions = links.filter(x => x.href.includes(MODULE_DESCRIPTION_LINK_CONTAINS) && x.childElementCount == 2);
                    moduleDescriptions.forEach(moduleDescription => {
                        // Get module names from first child in link element
                        let foundMatchingShortModule = moduleDescription.children[0].innerText.match(MODULE_SHORT_REGEX);
                        // Only if shorthand writing found
                        if (foundMatchingShortModule.length > 0) {
                            let matchFiltered = foundMatchingShortModule[foundMatchingShortModule.length - 1].slice(1, -1);
                            if (sections[currectModuleType]) {
                                sections[currectModuleType].push(matchFiltered);
                            }
                            else {
                                sections[currectModuleType] = [matchFiltered, ];
                            }
                        }
                    });
                }
            });
        
            console.log("loadModuleMap resolved");
            resolve(sections);
        }
    
        xhr.open("GET", selectedBachelor[1]);
        xhr.responseType = "document";
        xhr.send();
    });
}

function findEtcsMappings(moduleMap, selectedBachelor) {
    console.log("findEtcsMappings");
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
    
        xhr.onload = () => {
            let notAssignableModules = [];
            let body = xhr.response;
            let modules = body["items"];
            let mappedEtcs = JSON.parse(JSON.stringify(MAPPING_TABLE_TEMPLATE));

            modules.forEach(module => {
                let grading = module["note"] || module["grade"];
                let ects = Number(module["ects"]);
                let moduleNameQualified = module["anlassnumber"].match(MODULE_SHORT_REGEX_API);
                console.log(moduleNameQualified);
                // TODO: Exclude failing grades
                if (grading && ects && moduleNameQualified) {
                    // Check for manual map
                    let manualMap = PREV_MODULE_DECLARATIONS_MAP.find(x => x[0](selectedBachelor[0]) && 
                        x[1](module["anlassnumber"]));
                    if (manualMap) {
                        mappedEtcs[manualMap[2]][0] += ects;
                        mappedEtcs[manualMap[2]][1].push(module["anlassnumber"]);
                    }
                    else {
                        let moduleName = moduleNameQualified[moduleNameQualified.length - 1].slice(1, -1);
                        // Check if matching module name found
                        if (moduleName) {
                            let moduleCategory = 
                                Object.keys(moduleMap).find(key => moduleMap[key].includes(moduleName));
                            if (!moduleCategory) {
                                // Check if there are any within the key values that resemble the module name
                                // eg. "I.BA_IOTHACK_E.F2201" -> IOTHACK_E -> searches for IOTHACK
                                moduleCategory = Object.keys(moduleMap).find(key => moduleMap[key].some(r => moduleName.includes(r)));
                            }
                            if (!moduleCategory && moduleName.includes(ISA_MODULES)) {
                                moduleCategory = ISA_MODULES_AS;
                            }
                            // Check if still null
                            if (!moduleCategory) {
                                console.log("REMOVED: " + module["anlassnumber"]);
                                notAssignableModules.push(module["anlassnumber"] + " HAS CREDITS: " + ects);
                            }
                            // Add the ETCS points to the module category
                            else {
                                mappedEtcs[moduleCategory][0] += ects;
                                mappedEtcs[moduleCategory][1].push(module["anlassnumber"]);
                            }
                        }
                        else {
                            console.log("REMOVED: " + module["anlassnumber"]);
                            notAssignableModules.push(module["anlassnumber"] + " HAS CREDITS: " + ects);
                        }
                    }
                }
                else {
                    // Handle individual credits
                    if (ects && module["anlassnumber"].includes(INDIVIDUAL_CREDITS)) {
                        mappedEtcs[NAME_INDIVIDUAL_MODULES][0] += ects;
                        mappedEtcs[NAME_INDIVIDUAL_MODULES][1].push(module["anlassnumber"]);
                    }
                    else {
                        console.log("NOT GRADED: " + module["anlassnumber"]);
                        //notAssignableModules.push(module["anlassnumber"] + " HAS CREDITS: " + ects);
                    }
                }
            });
            console.log(mappedEtcs);
            resolve([mappedEtcs, notAssignableModules])
        }
    
        xhr.open("GET", USER_API_URL.formatUnicorn(window.jsBridge.options.dataSourceId));
        xhr.responseType = "json";
        xhr.send();
    });
}

loadAvailableBachelors().then(async availableBachelors => {
    this.availableBachelors = availableBachelors;
    let selectedBachelor = availableBachelors[0];
    this.moduleMap = await this.loadModuleMap(selectedBachelor);
    let moduleAssigns = await this.findEtcsMappings(this.moduleMap, selectedBachelor);
    this.mappedEtcs = moduleAssigns[0];
    this.notAssignableModules = moduleAssigns[1];
});