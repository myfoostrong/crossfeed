import { ECS } from "aws-sdk";
import * as Docker from "dockerode";

export interface CommandOptions {
  organizationId: String,
  organizationName: String,
  scanId: string,
  scanName: string
}

/**
 * ECS Client. Normally, submits jobs to ECS.
 * When the app is running locally, runs a
 * Docker container locally instead.
 */
class ECSClient {
  ecs?: ECS
  docker?: any
  isLocal: boolean

  constructor() {
    this.isLocal = (process.env.IS_OFFLINE || process.env.IS_LOCAL) ? true : false;
    // this.isLocal = false;
    if (this.isLocal) {
      this.docker = new Docker();
    } else {
      this.ecs = new ECS();
    }
  }

  /**
   * Launches an ECS task with the given command.
   * @param command Command to run (array of strings)
   */
  async runCommand(commandOptions: CommandOptions) {
    if (this.isLocal) {
      const container = await this.docker!.createContainer({
        Image: "crossfeed-worker",
        Env: ["CROSSFEED_COMMAND_OPTIONS=" + JSON.stringify(commandOptions)]
      });
      await container.start();
      return {
        tasks: [
          {}
        ]
      };
    }
    const { scanId, scanName, organizationId, organizationName } = commandOptions;
    return this.ecs!.runTask({
      cluster: "crossfeed-staging-worker", // aws_ecs_cluster.worker.name
      taskDefinition: "crossfeed-staging-worker", // aws_ecs_task_definition.worker.name
      networkConfiguration: {
        awsvpcConfiguration: {
          securityGroups: ["sg-088b4691e1cafd8c0"], // lambda sg id
          subnets: ["subnet-005633f93180b0beb"], // subnet id
        }
      },
      platformVersion: "1.4.0",
      launchType: "FARGATE",
      tags: [
        {
          key: "scanId",
          value: scanId
        },
        {
          key: "scanName",
          value: scanName
        },
        {
          key: "organizationId",
          value: organizationId,
        },
        {
          key: "organizationName",
          value: organizationName
        }
      ],
      overrides: {
        containerOverrides: [
          {
            name: "main", // from task definition
            environment: [
              {
                name: "CROSSFEED_COMMAND_OPTIONS",
                value: JSON.stringify(commandOptions)
              }
            ]
          }
        ]
      }
    } as ECS.RunTaskRequest).promise();
  }
}

export default ECSClient;