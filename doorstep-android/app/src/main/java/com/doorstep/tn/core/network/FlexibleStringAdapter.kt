package com.doorstep.tn.core.network

import com.squareup.moshi.FromJson
import com.squareup.moshi.ToJson

/**
 * Moshi adapter that converts numeric JSON values to String.
 * Handles cases where the server returns numbers for decimal fields
 * but the Kotlin model expects String.
 */
class FlexibleStringAdapter {
    
    @FromJson
    @FlexibleString
    fun fromJson(value: Any?): String? {
        return value?.toString()
    }
    
    @ToJson
    fun toJson(@FlexibleString value: String?): String? {
        return value
    }
}

/**
 * Qualifier annotation for fields that should accept both String and Number from JSON
 */
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FIELD, AnnotationTarget.VALUE_PARAMETER, AnnotationTarget.FUNCTION)
annotation class FlexibleString
