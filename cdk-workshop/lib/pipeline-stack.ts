import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  CodeBuildStep,
  CodePipeline,
  CodePipelineSource,
} from 'aws-cdk-lib/pipelines';
import { Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { WorkshopPipelineStage } from "./pipeline-stage";

export class WorkshopPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* 必要な情報をコマンドライン引数経由で取得 */
    const owner = this.node.tryGetContext('Owner') as string
    const repository = this.node.tryGetContext('Repository') as string
    const branch = this.node.tryGetContext('Branch') as string
    const connectionArn = this.node.tryGetContext('ConnectionArn') as string

    // The basic pipeline declaration. This sets the initial structure
    // of our pipeline
    const pipeline = new CodePipeline(this, 'CodePipeline', {
      codePipeline: new Pipeline(this, 'Pipeline', {
        restartExecutionOnUpdate: false,
      }),
      selfMutation: false,
      synth: new CodeBuildStep('SynthStep', {
        /* GitHubから読み込み */
        input: CodePipelineSource.connection(
          `${owner}/${repository}`,
          `${branch}`,
          {
            connectionArn: connectionArn,
            triggerOnPush: true
          }
        ),
        installCommands: ['npm install -g aws-cdk'],
        commands: [
          'cd cdk-workshop',
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
        primaryOutputDirectory: 'cdk-workshop/cdk.out',
      }),
    });

    const deploy = new WorkshopPipelineStage(this, "Deploy");
    const deployStage = pipeline.addStage(deploy);

    deployStage.addPost(
      new CodeBuildStep('TestViewerEndpoint', {
        projectName: 'TestViewerEndpoint',
        envFromCfnOutputs: {
          ENDPOINT_URL: deploy.hcViewerUrl,
        },
        commands: [
          'curl -Ssf $ENDPOINT_URL'
        ]
      }),

      new CodeBuildStep('TestAPIGatewayEndpoint', {
        projectName: 'TestAPIGatewayEndpoint',
        envFromCfnOutputs: {
          ENDPOINT_URL: deploy.hcEndpoint,
        },
        commands: [
          'curl -Ssf $ENDPOINT_URL',
          'curl -Ssf $ENDPOINT_URL/hello',
          'curl -Ssf $ENDPOINT_URL/test'
        ]
      })
    )
  }
}
