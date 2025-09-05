declare module 'passport-jwt' {
  import { Strategy as PassportStrategy } from 'passport-strategy';
  
  export interface StrategyOptions {
    jwtFromRequest: ExtractJwt;
    secretOrKey: string | Buffer;
    issuer?: string;
    audience?: string;
    algorithms?: string[];
    ignoreExpiration?: boolean;
    passReqToCallback?: boolean;
    jsonWebTokenOptions?: any;
  }

  export interface VerifyCallback {
    (err: any, user?: any, info?: any): void;
  }

  export interface VerifyFunction {
    (payload: any, done: VerifyCallback): void;
  }

  export interface VerifyFunctionWithRequest {
    (req: any, payload: any, done: VerifyCallback): void;
  }

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
    constructor(options: StrategyOptions, verify: VerifyFunctionWithRequest);
  }

  export class ExtractJwt {
    static fromHeader(header: string): ExtractJwt;
    static fromBodyField(field: string): ExtractJwt;
    static fromUrlQueryParameter(param: string): ExtractJwt;
    static fromAuthHeaderWithScheme(scheme: string): ExtractJwt;
    static fromAuthHeaderAsBearerToken(): ExtractJwt;
    static fromExtractors(extractors: ExtractJwt[]): ExtractJwt;
  }
}