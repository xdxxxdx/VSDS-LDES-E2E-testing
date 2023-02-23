import { After, Given, When, Then, Before } from "@badeball/cypress-cucumber-preprocessor";
import { DockerCompose, credentials, DockerComposeOptions } from "..";
import {
    LdesWorkbenchNiFi, LdesServerSimulator, LdesClientSink,
    MongoRestApi, JsonDataGenerator, LdesServer
} from "../services";

let testContext: any;

export const dockerCompose = new DockerCompose(Cypress.env('useDefaultTags'));
export const workbench = new LdesWorkbenchNiFi('https://localhost:8443')
export const sink = new LdesClientSink('http://localhost:9003');
export const simulator = new LdesServerSimulator('http://localhost:9011');
export const mongo = new MongoRestApi('http://localhost:9019');
export const jsonDataGenerator = new JsonDataGenerator();
export const server = new LdesServer('http://localhost:8080');

Before(() => {
    dockerCompose.down();
    dockerCompose.initialize();

    testContext = {
        testPartialPath: '',
        additionalEnvironmentSetting: {},
        database: '',
        collection: '',
    }
});

After(() => {
    dockerCompose.down();
});

export function testPartialPath() {
    return testContext && testContext.testPartialPath;
}

// Given stuff

Given('the members are stored in collection {string} in database {string}', (collection: string, database: string) => {
    testContext.database = database;
    testContext.collection = collection;
});


Given('the {string} test is setup', (testPartialPath: string) => {
    testContext.testPartialPath = testPartialPath;
});

Given('context {string} is started', (composeFilePath: string) => {
    const options: DockerComposeOptions = {
        dockerComposeFile: `${composeFilePath}/docker-compose.yml`,
        environmentFile: `${testContext.testPartialPath}/.env`,
        additionalEnvironmentSetting: testContext.additionalEnvironmentSetting
    };
    dockerCompose.up(options);
})

Given('I have logged on to the Apache NiFi UI', () => {
    workbench.waitAvailable();
    workbench.logon(credentials);
});

Given('I have uploaded the workflow', () => {
    workbench.uploadWorkflow(`${testContext.testPartialPath}/nifi-workflow.json`);
})

Given('I have aliased the pre-seeded simulator data set', () => {
    simulator.waitAvailable();
    simulator.seed(Cypress.env('gipodDataSet'));
    simulator.postAlias(`${testContext.testPartialPath}/create-alias.json`);
})

Given('I have uploaded the data files: {string}', (dataSet: string) => {
    simulator.waitAvailable();
    dataSet.split(',').forEach(baseName => simulator.postFragment(`${testContext.testPartialPath}/data/${baseName}.jsonld`));
})

Given('I have uploaded the data files: {string} with a duration of {int} seconds', (dataSet: string, seconds: number) => {
    simulator.waitAvailable();
    dataSet.split(',').forEach(baseName => simulator.postFragment(`${testContext.testPartialPath}/data/${baseName}.jsonld`, seconds));
})

Given('I have aliased the data set', () => {
    simulator.waitAvailable();
    simulator.postAlias(`${testContext.testPartialPath}/create-alias.json`);
})

Given('I have configured the {string} as {string}', (property: string, value: string) => {
    testContext.additionalEnvironmentSetting[property] = value;
})

Given('the LDES server is available', () => {
    return server.waitAvailable();
})

// When stuff

When('I start the workflow', () => {
    workbench.pushStart();
})

When('I upload the data files: {string} with a duration of {int} seconds', (dataSet: string, seconds: number) => {
    simulator.waitAvailable();
    dataSet.split(',').forEach(baseName => simulator.postFragment(`${testContext.testPartialPath}/data/${baseName}.jsonld`, seconds));
})

When('I start the service named {string}', (service: string) => {
    dockerCompose.up({ delayedService: service });
})

When('I start the JSON Data Generator', () => {
    dockerCompose.up({
        delayedService: jsonDataGenerator.serviceName,
        additionalEnvironmentSetting: { JSON_DATA_GENERATOR_SILENT: false }
    });
    jsonDataGenerator.waitAvailable();
})

When('the LDES contains at least {int} members', (count: number) => {
    mongo.checkCount(testContext.database, testContext.collection, count, (x, y) => x >= y);
})

// Then stuff

Then('the sink contains {int} members', (count: number) => {
    sink.checkCount('mobility-hindrances', count);
})

Then('the LDES contains {int} members', (count: number) => {
    mongo.checkCount(testContext.database, testContext.collection, count);
})

