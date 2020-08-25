/*
 * Copyright 2019-present Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#include <stdlib.h>
#include "aws/lambda-runtime/runtime.h"
#include "aws/lambda-runtime/version.h"
#include "napi.h"

#include <chrono>

static aws::lambda_runtime::runtime *CLIENT;

Napi::Value InitializeClient(const Napi::CallbackInfo & info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Wrong number of arguments, expected 1").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (CLIENT != nullptr) {
        Napi::TypeError::New(env, "Client already initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    auto userAgent = info[0].As<Napi::String>().Utf8Value();
    CLIENT = new aws::lambda_runtime::runtime(getenv("AWS_LAMBDA_RUNTIME_API"), userAgent);
    return env.Null();
}

Napi::Value Next(const Napi::CallbackInfo & info)
{
    Napi::Env env = info.Env();
    if (CLIENT == nullptr) {
        Napi::TypeError::New(env, "Client not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    auto outcome = CLIENT->get_next();
    if (!outcome.is_success()) {
        Napi::TypeError::New(env, "Failed to get next!").ThrowAsJavaScriptException();
        return env.Null();
    }

    // TODO: See if json parsing works on V8:Buffer objects, which might be a way to reduce copying large payloads
    auto response = outcome.get_result();
    auto response_data = Napi::String::New(env, response.payload.c_str());

    // TODO: The current javascript code (InvokeContext.js) to handle the header values itself.
    // These type conversions might be replaced by returning the final context object.
    auto headers = Napi::Object::New(env);
    headers.Set(
        Napi::String::New(env, "lambda-runtime-deadline-ms"),
        Napi::Number::New(env,
            std::chrono::duration_cast<std::chrono::milliseconds>(
                response.deadline.time_since_epoch()
            ).count()
        ));
    headers.Set(
        Napi::String::New(env, "lambda-runtime-aws-request-id"),
        Napi::String::New(env, response.request_id.c_str()));
    headers.Set(
        Napi::String::New(env, "lambda-runtime-trace-id"),
        Napi::String::New(env, response.xray_trace_id.c_str()));
    headers.Set(
        Napi::String::New(env, "lambda-runtime-invoked-function-arn"),
        Napi::String::New(env, response.function_arn.c_str()));
    if (response.client_context != "") {
        headers.Set(
            Napi::String::New(env, "lambda-runtime-client-context"),
            Napi::String::New(env, response.client_context.c_str()));
    }
    if (response.cognito_identity != "") {
        headers.Set(
            Napi::String::New(env, "lambda-runtime-cognito-identity"),
            Napi::String::New(env, response.cognito_identity.c_str()));
    }

    auto ret = Napi::Object::New(env);
    ret.Set(Napi::String::New(env, "bodyJson"), response_data);
    ret.Set(Napi::String::New(env, "headers"), headers);

    return ret;
}

Napi::Value Done(const Napi::CallbackInfo & info)
{
    Napi::Env env = info.Env();
    if (CLIENT == nullptr) {
        Napi::TypeError::New(env, "Client not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Wrong number of arguments, expected 2").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[0].IsString() || !info[1].IsString()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    auto requestId = info[0].As<Napi::String>();
    auto responseString = info[1].As<Napi::String>();
    auto response = aws::lambda_runtime::invocation_response::success(responseString.Utf8Value(), "application/json");
    auto outcome = CLIENT->post_success(requestId.Utf8Value(), response);
    return env.Null();
}

Napi::Value Error(const Napi::CallbackInfo & info)
{
    Napi::Env env = info.Env();
    if (CLIENT == nullptr) {
        Napi::TypeError::New(env, "Client not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Wrong number of arguments, expected 3").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[0].IsString() || !info[1].IsString() || !info[2].IsString()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    auto requestId = info[0].As<Napi::String>();
    auto responseString = info[1].As<Napi::String>();
    auto xrayResponse = info[2].As<Napi::String>();
    auto response = aws::lambda_runtime::invocation_response(responseString.Utf8Value(), "application/json", false, xrayResponse.Utf8Value());
    auto outcome = CLIENT->post_failure(requestId.Utf8Value(), response);
    return env.Null();
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set(Napi::String::New(env, "initializeClient"), Napi::Function::New(env, InitializeClient));
    exports.Set(Napi::String::New(env, "next"), Napi::Function::New(env, Next));
    exports.Set(Napi::String::New(env, "done"), Napi::Function::New(env, Done));
    exports.Set(Napi::String::New(env, "error"), Napi::Function::New(env, Error));
    return exports;
}

NODE_API_MODULE(addon, Init);
